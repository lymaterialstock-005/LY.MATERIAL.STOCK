/**
 * 全面雲端化入出庫兼採購系統 - app.js
 */

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwqFoRX-lMt38ho00ACFIF6AsjSOgkT8LTKVed0kYAm1ZyDh5qYW7Rz-t-P3KDwx3oMZQ/exec';

let inventoryData = [], itemList = [], currentCat = '全部', isCollapsed = false, editingMasterId = null;
const norm = s => (s || '').toString().trim().toUpperCase();
const documentGet = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    fetchInventoryData();
    setupEvents();
});

async function fetchInventoryData() {
    try {
        setBar(true);
        const res = await fetch(`${GAS_WEB_APP_URL}?action=getInventory`);
        const data = await res.json();
        
        if (data && data.status === 'success') {
            // 這裡修正為對應後端的 inventory 屬性
            inventoryData = data.inventory || [];
            if (data.categories && data.categories.length > 0) {
                // 如果需要同步分類也可以在這裡處理
            }
            renderCat();
            renderSummary();
        }
    } catch (e) {
        console.error("載入失敗：", e);
    } finally {
        setBar(false);
    }
}

function renderCat() {
    const container = documentGet('categoryChips');
    if (!container) return;
    // 這裡維持您原本的分類渲染邏輯
}

function renderSummary() {
    const container = documentGet('inventoryStockSummary');
    if (!container) return;
    
    let list = inventoryData;
    if (currentCat !== '全部') {
        list = inventoryData.filter(i => i.category === currentCat);
    }

    if (!list.length) {
        container.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">目前無物料資料</div>`;
        return;
    }

    container.innerHTML = list.map(i => {
        let low = Number(i.safetyStock) > 0 && Number(i.qty || 0) <= Number(i.safetyStock);
        return `<div class="card stock-card-item ${low ? 'k-warn' : 'k-ok'}" data-name="${i.name}" data-thick="${i.thickness||''}" style="margin-bottom:8px;padding:12px;cursor:pointer;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:15px;">${i.name} ${i.thickness?'('+i.thickness+'mm)':''}</strong>
            <span style="color:${low?'#ef4444':'#10b981'};font-weight:bold;">庫存:${i.qty||0}</span>
          </div>
          <div style="font-size:12px;color:#aaa;margin-top:4px;">分類:${i.category} | 規格:${i.size||'無'} | 安全:${i.safetyStock||0} | MOQ:${i.moq||0}</div>
        </div>`;
    }).join('');
}

function setupEvents() {
    documentGet('btnToggleSummary')?.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        const summary = documentGet('inventoryStockSummary');
        if (summary) summary.style.display = isCollapsed ? 'none' : 'block';
        const btn = documentGet('btnToggleSummary');
        if (btn) btn.innerText = isCollapsed ? '展開 ▼' : '收起 ▲';
    });

    documentGet('btnIn')?.addEventListener('click', () => handleTx('IN'));
    documentGet('btnOut')?.addEventListener('click', () => handleTx('OUT'));
}

async function handleTx(type) {
    let name = norm(documentGet('txMaterialName')?.value);
    let thick = norm(documentGet('txThickness')?.value);
    let qty = Number(documentGet('txQty')?.value);

    if (!name || !qty || qty <= 0) return alert("請完整填寫品名與數量！");

    try {
        setBar(true);
        let res = await fetch(GAS_WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: type.toLowerCase(), materialName: name, thickness: thick, qty: qty })
        });
        let r = await res.json();
        if (r.status === 'success') {
            alert(type === 'IN' ? "✅ 入庫成功！" : "✅ 出庫成功！");
            documentGet('txQty').value = '';
            documentGet('txMaterialName').value = '';
            documentGet('txThickness').value = '';
            fetchInventoryData();
        } else {
            alert("操作失敗：" + r.message);
        }
    } catch (e) {
        console.error(e);
        alert("連線失敗");
    } finally {
        setBar(false);
    }
}

function setBar(loading) {
    let bar = documentGet('status-bar');
    if (bar) {
        bar.innerText = loading ? '⏳ 正在連線至雲端資料庫...' : '🟢 系統就緒';
        bar.style.backgroundColor = loading ? '#d97706' : '#166534';
    }
}
