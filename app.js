/**
 * 全面端點化出庫採購採購系統前端程式碼 (app.js)
 * 已更新最新 GAS Webhook URL
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
        const res = await fetch(`${GAS_WEB_APP_URL}?action=getInventory`);
        const data = await res.json();
        if (data.status === 'success') {
            inventoryData = data.inventory || [];
            itemList = data.categories || [];
            renderCategories();
            renderSummary();
            renderTable();
        }
    } catch (e) {
        console.error('取得資料失敗', e);
    }
}

function renderCategories() {
    const container = documentGet('CategoryChips');
    if (!container) return;
    let cats = ['全部', '庫存過低', ...itemList];
    container.innerHTML = cats.map(c => `<button class="chip ${c === currentCat ? 'active' : ''}" onclick="selectCategory('${c}')">${c}</button>`).join('');
}

function selectCategory(cat) {
    currentCat = cat;
    renderCategories();
    renderTable();
}

function renderSummary() {
    const container = documentGet('InventorySummary');
    if (!container) return;
    const totalItems = inventoryData.length;
    const lowStockItems = inventoryData.filter(i => Number(i.qty) <= Number(i.safetyStock) && Number(i.safetyStock) > 0).length;
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #2d3748; padding: 12px; border-radius: 8px; color: white;">
            <span>📦 總品項數: <b>${totalItems}</b></span>
            <span>⚠️ 庫存過低: <b style="color: #fc8181;">${lowStockItems}</b></span>
        </div>
    `;
}

function renderTable() {
    const container = documentGet('InventoryTable');
    if (!container) return;
    let filtered = inventoryData.filter(i => {
        if (currentCat === '全部') return true;
        if (currentCat === '庫存過低') return Number(i.qty) <= Number(i.safetyStock) && Number(i.safetyStock) > 0;
        return i.category === currentCat;
    });

    const searchKeyword = norm(documentGet('SearchInput')?.value);
    if (searchKeyword) {
        filtered = filtered.filter(i => norm(i.name).includes(searchKeyword) || norm(i.spec).includes(searchKeyword));
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">目前無物料資料</div>`;
        return;
    }

    container.innerHTML = filtered.map(i => `
        <div style="background: #1a202c; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid ${Number(i.qty) <= Number(i.safetyStock) && Number(i.safetyStock) > 0 ? '#fc8181' : '#48bb78'};">
            <div style="display: flex; justify-content: space-between;">
                <b>${i.name} (${i.thickness || '無厚度'})</b>
                <span>庫存: <b>${i.qty}</b></span>
            </div>
            <div style="font-size: 12px; color: #a0aec0; margin-top: 4px;">
                分類: ${i.category} | 規格: ${i.size || '-'} | 安全庫存: ${i.safetyStock} | MOQ: ${i.moq}
            </div>
        </div>
    `).join('');
}

function setupEvents() {
    const searchInput = documentGet('SearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
}

async function handleAction(type) {
    const name = documentGet('InputName')?.value;
    const thickness = documentGet('InputThickness')?.value;
    const qty = documentGet('InputQty')?.value;

    if (!name || !qty) {
        alert('請填寫完整品名與數量');
        return;
    }

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'addLog',
                log: {
                    type: type, // 'IN' 或 'OUT'
                    materialName: name,
                    thickness: thickness,
                    qty: Number(qty),
                    time: new Date().toLocaleString()
                }
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(type === 'IN' ? '入庫成功！' : '出庫成功！');
            documentGet('InputName').value = '';
            documentGet('InputThickness').value = '';
            documentGet('InputQty').value = '';
            fetchInventoryData();
        } else {
            alert('操作失敗: ' + (data.message || '未知錯誤'));
        }
    } catch (e) {
        alert('連線伺服器失敗');
    }
}
