/**
 * 全面雲端化入出庫兼採購系統 - app.js
 * 完整還原所有 Modal 互動、尺寸、安全庫存、MOQ 與雲端同步
 */

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1dHo2tUXua5hRPYxdKy7T7HmZ8wLdpZxrZna-matd_xsN6E_QHZ-bOdoudAAt78PsoA/exec";

let inventoryData = [], categoriesList = [], currentCat = '全部', isCollapsed = false, editingMasterId = null;
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
    if (data) {
      if (data.masters) inventoryData = data.masters;
      if (data.categories) categoriesList = data.categories;
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
  const cats = ['全部', 'WARN', ...categoriesList];
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
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:15px;">${i.name} ${i.thickness?'('+i.thickness+'mm)':''}</strong>
        <span style="color:${low?'#ef4444':'#10b981'};font-weight:bold;">庫存:${i.stock||0}</span>
      </div>
      <div style="font-size:12px;color:#aaa;margin-top:4px;">分類:${i.category} | 規格:${i.size||'無'} | 安全:${i.safetyStock||0} | MOQ:${i.moq||0}</div>
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

  // 快捷新增主檔按鈕 (+)
  $('btnAddMasterQuick')?.addEventListener('click', () => {
    openMasterModal(normStr($('txMaterialName')?.value), normStr($('txThickness')?.value));
  });

  // 關閉主檔 Modal
  $('btnCloseMaster')?.addEventListener('click', closeMasterModal);
  $('masterModal')?.addEventListener('click', e => {
    if (e.target.id === 'masterModal') closeMasterModal();
  });

  // 選擇分類按鈕
  $('btnOpenCategoryPicker')?.addEventListener('click', openCatPicker);
  $('btnCloseCategoryPicker')?.addEventListener('click', closeCatPicker);
  $('categoryPickerModal')?.addEventListener('click', e => {
    if (e.target.id === 'categoryPickerModal') closeCatPicker();
  });

  // 新增自定義分類
  $('btnAddCustomCategory')?.addEventListener('click', () => {
    let newCat = prompt('請輸入新分類名稱：');
    if (newCat && newCat.trim()) {
      let trimmed = newCat.trim();
      if (!categoriesList.includes(trimmed)) {
        categoriesList.push(trimmed);
        saveCategoriesToCloud();
      }
      $('newMasterCategory').value = trimmed;
      closeCatPicker();
    }
  });

  // 儲存新主檔
  $('btnSaveNewMaster')?.addEventListener('click', saveMasterFromModal);

  // 批次刪除分類
  $('btnOpenCatModal')?.addEventListener('click', openBatchDeleteModal);
  $('btnCloseCatBatchModal')?.addEventListener('click', closeBatchDeleteModal);
  $('catBatchModal')?.addEventListener('click', e => {
    if (e.target.id === 'catBatchModal') closeBatchDeleteModal();
  });
  $('btnConfirmBatchDelete')?.addEventListener('click', confirmBatchDelete);

  // 點擊卡片帶入交易表單
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

function openMasterModal(name = '', thick = '') {
  editingMasterId = Date.now();
  if ($('newMasterName')) $('newMasterName').value = name;
  if ($('newMasterCategory')) $('newMasterCategory').value = categoriesList[0] || '其他';
  if ($('newMasterThickness')) $('newMasterThickness').value = thick;
  if ($('newMasterSize')) $('newMasterSize').value = '';
  if ($('newMasterSafetyStock')) $('newMasterSafetyStock').value = '0';
  if ($('newMasterMoq')) $('newMasterMoq').value = '0';
  if ($('masterModal')) $('masterModal').style.display = 'flex';
}

function closeMasterModal() {
  if ($('masterModal')) $('masterModal').style.display = 'none';
}

function openCatPicker() {
  const grid = $('categoryPickerGrid');
  if (!grid) return;
  grid.innerHTML = categoriesList.map(c => `<button type="button" class="cat-picker-btn" data-cat="${c}" style="padding:10px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">${c}</button>`).join('');
  
  grid.querySelectorAll('.cat-picker-btn').forEach(btn => {
    btn.onclick = () => {
      $('newMasterCategory').value = btn.dataset.cat;
      closeCatPicker();
    };
  });
  if ($('categoryPickerModal')) $('categoryPickerModal').style.display = 'flex';
}

function closeCatPicker() {
  if ($('categoryPickerModal')) $('categoryPickerModal').style.display = 'none';
}

async function saveMasterFromModal() {
  let name = normStr($('newMasterName')?.value);
  let category = $('newMasterCategory')?.value || '其他';
  let thickness = normStr($('newMasterThickness')?.value);
  let size = normStr($('newMasterSize')?.value);
  let safetyStock = Number($('newMasterSafetyStock')?.value) || 0;
  let moq = Number($('newMasterMoq')?.value) || 0;

  if (!name) return alert('請輸入品名！');

  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveMaster",
        payload: { id: editingMasterId, category, name, thickness, size, safetyStock, moq }
      })
    });
    let r = await res.json();
    if (r.status === 'success') {
      alert(`✅ 成功新增物料主檔：「${name}」！`);
      closeMasterModal();
      fetchInventoryData();
    }
  } catch (e) {
    alert("儲存主檔失敗");
  } finally {
    setBar(false);
  }
}

function openBatchDeleteModal() {
  const listDiv = $('catCheckboxList');
  if (!listDiv) return;
  listDiv.innerHTML = categoriesList.map(c => `
    <label style="display:flex;align-items:center;gap:8px;background:#222;padding:8px;border-radius:6px;color:#fff;cursor:pointer;">
      <input type="checkbox" value="${c}" class="cat-batch-checkbox" style="width:18px;height:18px;">
      <span>${c}</span>
    </label>
  `).join('');
  if ($('catBatchModal')) $('catBatchModal').style.display = 'flex';
}

function closeBatchDeleteModal() {
  if ($('catBatchModal')) $('catBatchModal').style.display = 'none';
}

async function confirmBatchDelete() {
  let checks = document.querySelectorAll('.cat-batch-checkbox:checked');
  let selected = Array.from(checks).map(cb => cb.value);
  if (!selected.length) return alert('請至少勾選一個分類！');
  if (!confirm(`⚠️ 確定要刪除選中的 ${selected.length} 個分類及底下所有物料嗎？`)) return;

  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batchDeleteCategories", payload: selected })
    });
    let r = await res.json();
    if (r.status === 'success') {
      alert("✅ 批次刪除成功！");
      closeBatchDeleteModal();
      fetchInventoryData();
    }
  } catch (e) {
    alert("刪除失敗");
  } finally {
    setBar(false);
  }
}

async function saveCategoriesToCloud() {
  await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveCategories", payload: categoriesList })
  });
}

async function handleTx(type) {
  let name = normStr($('txMaterialName')?.value);
  let thick = normStr($('txThickness')?.value);
  let qty = Number($('txQty')?.value);

  if (!name || !qty || qty <= 0) return alert("請完整填寫品名與數量！");

  // 檢查主檔是否存在
  let found = inventoryData.find(i => normStr(i.name) === name && (normStr(i.thickness) === thick || !thick));
  if (!found) {
    if (confirm(`⚠️ 查無「${name}」的物料主檔，是否立即建立主檔？`)) {
      openMasterModal(name, thick);
    }
    return;
  }

  try {
    setBar(true);
    let res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addTransaction",
        payload: { id: Date.now(), type, materialName: name, thickness: thick || '0', qty, time: new Date().toLocaleString() }
      })
    });
    let r = await res.json();
    if (r.status === 'success') {
      alert(type === 'IN' ? "✅ 入庫成功！" : "✅ 出庫成功！");
      if ($('txQty')) $('txQty').value = '';
      if ($('txMaterialName')) $('txMaterialName').value = '';
      if ($('txThickness')) $('txThickness').value = '';
      fetchInventoryData();
    }
  } catch (e) {
    alert("交易失敗");
  } finally {
    setBar(false);
  }
}

function setBar(loading) {
  let bar = $('status-bar');
  if (bar) {
    bar.innerText = loading ? '⏳ 正在同步...' : '🟢 系統就緒';
    bar.style.backgroundColor = loading ? '#d97706' : '#166534';
  }
}
