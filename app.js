const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1dHo2tUXua5hRPYxdKy7T7HmZ8wLdpZxrZna-matd_xsN6E_QHZ-bOdoudAAt78PsoA/exec";
let inventoryData = [], currentCat = '全部', isCollapsed = false;
const $ = id => document.getElementById(id);

const normStr = s => s ? s.toString().trim().toUpperCase().replace(/(^|[^0-9])\.([0-9]+)/g, '$10.$2') : '';

document.addEventListener("DOMContentLoaded", () => {
  fetchInventoryData();
  setupEvents();
});

async function fetchInventoryData() {
  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL + "?action=getInventory");
    let data = await res.json();
    if (data && data.masters) {
      inventoryData = data.masters;
      renderChips();
      renderSummary();
    }
  } catch (e) {
    console.error(e);
    alert("雲端連線失敗");
  } finally {
    setBar(false);
  }
}

function renderChips() {
  const container = $('categoryChips');
  if (!container) return;
  const cats = ['全部', 'WARN', ...new Set(inventoryData.map(i => i.category))];
  container.innerHTML = cats.map(c => `<button type="button" class="chip ${currentCat === c ? 'active' : ''}" data-cat="${c}">${c === 'WARN' ? '⚠️ 庫存過低' : c}</button>`).join('');
}

function renderSummary() {
  const div = $('inventoryStockSummary');
  if (!div) return;
  let list = inventoryData;
  if (currentCat === 'WARN') {
    list = inventoryData.filter(i => Number(i.safetyStock) > 0 && Number(i.stock || 0) <= Number(i.safetyStock));
  } else if (currentCat !== '全部') {
    list = inventoryData.filter(i => i.category === currentCat);
  }
  const kw = normStr($('search-input')?.value);
  if (kw) list = list.filter(i => normStr(i.name).includes(kw));

  if (!list.length) {
    div.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">目前無物料資料</div>`;
    return;
  }

  div.innerHTML = list.map(i => {
    let low = Number(i.safetyStock) > 0 && Number(i.stock || 0) <= Number(i.safetyStock);
    return `<div class="card stock-card-item ${low ? 'k-warn' : 'k-ok'}" data-name="${i.name}" data-thick="${i.thickness||''}" style="margin-bottom:8px;padding:12px;cursor:pointer;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;"><strong>${i.name} ${i.thickness?'('+i.thickness+'mm)':''}</strong><span style="color:${low?'#ef4444':'#10b981'}">庫存:${i.stock||0}</span></div>
      <div style="font-size:12px;color:#aaa;margin-top:4px;">分類:${i.category} | 安全:${i.safetyStock||0}</div>
    </div>`;
  }).join('');
}

function setupEvents() {
  $('search-input')?.addEventListener('input', renderSummary);
  
  $('categoryChips')?.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) {
      currentCat = e.target.dataset.cat;
      isCollapsed = false;
      $('inventoryStockSummary').style.display = 'block';
      if ($('btnToggleSummary')) $('btnToggleSummary').innerText = '收起 ▲';
      renderChips();
      renderSummary();
    }
  });

  $('btnToggleSummary')?.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    $('inventoryStockSummary').style.display = isCollapsed ? 'none' : 'block';
    $('btnToggleSummary').innerText = isCollapsed ? '展開 ▼' : '收起 ▲';
  });

  $('btnAddMasterQuick')?.addEventListener('click', () => {
    let name = prompt("請輸入物料名稱：", normStr($('txMaterialName')?.value));
    if (name) {
      let cat = prompt("請輸入分類：", "其他");
      let thick = prompt("請輸入厚度 (mm)：", normStr($('txThickness')?.value));
      saveMaster(cat || "其他", name, thick);
    }
  });

  document.addEventListener('click', e => {
    let card = e.target.closest('.stock-card-item');
    if (card) {
      if ($('txMaterialName')) $('txMaterialName').value = normStr(card.dataset.name);
      if ($('txThickness')) $('txThickness').value = normStr(card.dataset.thick);
      $('txCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  $('btnIn')?.addEventListener('click', () => handleTx('IN'));
  $('btnOut')?.addEventListener('click', () => handleTx('OUT'));
}

async function saveMaster(cat, name, thick) {
  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveMaster", payload: { id: Date.now(), category: cat, name: normStr(name), thickness: normStr(thick), safetyStock: 5, moq: 1 } })
    });
    let r = await res.json();
    if (r.status === 'success') { alert("✅ 主檔儲存成功！"); fetchInventoryData(); }
  } catch (e) { alert("儲存失敗"); } finally { setBar(false); }
}

async function handleTx(type) {
  let name = normStr($('txMaterialName')?.value);
  let thick = normStr($('txThickness')?.value);
  let qty = Number($('txQty')?.value);
  if (!name || !qty || qty <= 0) return alert("請完整填寫品名與數量！");
  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addTransaction", payload: { id: Date.now(), type, materialName: name, thickness: thick || '0', qty, time: new Date().toLocaleString() } })
    });
    let r = await res.json();
    if (r.status === 'success') {
      alert(type === 'IN' ? "✅ 入庫成功！" : "✅ 出庫成功！");
      if ($('txQty')) $('txQty').value = '';
      if ($('txMaterialName')) $('txMaterialName').value = '';
      if ($('txThickness')) $('txThickness').value = '';
      fetchInventoryData();
    }
  } catch (e) { alert("交易失敗"); } finally { setBar(false); }
}

function setBar(loading) {
  let bar = $('status-bar');
  if (bar) {
    bar.innerText = loading ? '⏳ 正在同步...' : '🟢 系統就緒';
    bar.style.backgroundColor = loading ? '#d97706' : '#166534';
  }
}
