/**
 * 全面端化入出庫採購系統前端程式碼
 * 已更新最新 GAS Webhook 網址
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwqFoRX-lMt38ho00ACFIF6AsjSOgkT8LTKVed0kYAm1ZyDh5qYW7Rz-t-P3KDwx3oMZQ/exec';

let inventoryData = [], categories = ['德昱興', '華立', '樂樂', 'PORON', '泡棉', '3M', '國貿', '晉昌', '培遠', '其他'], currentCat = '全部', isCollapsed = false, editingMasterId = null;
let const normStr = s => (s || '').toString().trim().toUpperCase();

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
      if (data.categories && data.categories.length > 0) categories = data.categories;
    }
  } catch (err) {
    console.error('取得資料失敗', err);
  } finally {
    renderChips();
    renderSummary();
  }
}

function renderChips() {
  const container = document.getElementById('categoryChips');
  if (!container) return;
  let cats = ['全部', '庫存過低', ...categories];
  container.innerHTML = cats.map(c => `<button class="chip ${c === currentCat ? 'active' : ''}" onclick="filterCat('${c}')">${c}</button>`).join('');
}

function renderSummary() {
  const container = document.getElementById('inventorySummary');
  if (!container) return;
  let list = inventoryData;
  if (currentCat === '庫存過低') {
    list = inventoryData.filter(i => Number(i.stock) <= Number(i.safetyStock) && Number(i.safetyStock) > 0);
  } else if (currentCat !== '全部') {
    list = inventoryData.filter(i => i.category === currentCat);
  }

  if (list.length === 0) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#886;">目前無物料資料</div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    let isLow = Number(item.safetyStock) > 0 && Number(item.stock) <= Number(item.safetyStock);
    let t = (item.thickness || '').toString().trim();
    let s = (item.size || '').toString().trim();
    let specStr = t && s ? `${t}mm X ${s}` : (t ? `${t}mm` : (s ? s : '無規格'));
    return `
      <div style="background:#fff;border:1px solid ${isLow ? '#ff4d4f' : '#ddd'};border-radius:8px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:bold;font-size:16px;">${item.name} <span style="font-size:12px;color:#666;font-weight:normal;">(${specStr})</span></div>
          <div style="font-size:12px;color:#886;">分類:${item.category} | 規格:${specStr} | 安全:${item.safetyStock} | MOQ:${item.moq}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:bold;color:${isLow ? '#ff4d4f' : '#008000'};">庫存:${item.stock}</div>
          <button onclick="editMaster('${item.id}')" style="background:#007bff;color:#fff;border:none;padding:2px 8px;border-radius:4px;font-size:11px;margin-top:4px;">編輯</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterCat(cat) {
  currentCat = cat;
  renderChips();
  renderSummary();
}

function setupEvents() {
  const nameInput = document.getElementById('materialName');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      let val = normStr(e.target.value);
      let found = inventoryData.find(i => normStr(i.name) === val);
      if (found) {
        document.getElementById('thickness').value = found.thickness || '';
      }
    });
  }
}

async function handleAction(type) {
  const name = normStr(document.getElementById('materialName').value);
  const thickness = normStr(document.getElementById('thickness').value);
  const qty = Number(document.getElementById('qty').value);

  if (!name || !qty || qty <= 0) {
    alert('請填寫完整的品名與大於0的數量');
    return;
  }

  let found = inventoryData.find(i => normStr(i.name) === name);
  if (!found && type === 'IN') {
    if (confirm(`查無「${name}」的物料主檔，是否立即建立主檔？`)) {
      openMasterModal(name, thickness);
      return;
    } else {
      return;
    }
  }

  try {
    const payload = {
      action: 'addTransaction',
      log: {
        id: Date.now(),
        type: type,
        materialName: name,
        thickness: thickness,
        qty: qty,
        time: new Date().toLocaleString()
      }
    };
    
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === 'success') {
      alert(type === 'IN' ? '入庫成功！' : '出庫成功！');
      document.getElementById('materialName').value = '';
      document.getElementById('thickness').value = '';
      document.getElementById('qty').value = '';
      fetchInventoryData();
    } else {
      alert('操作失敗: ' + result.message);
    }
  } catch (err) {
    alert('網路異常，操作失敗');
  }
}

function openMasterModal(defaultName = '', defaultThickness = '') {
  let name = prompt('請輸入物料名稱:', defaultName);
  if (!name) return;
  let category = prompt('請輸入分類 (' + categories.join(', ') + '):', categories[0]);
  if (!category) return;
  let thickness = prompt('請輸入厚度 (mm):', defaultThickness);
  let size = prompt('請輸入尺寸 (例如 930x680M):', '');
  let safetyStock = prompt('請輸入安全庫存:', '0');
  let moq = prompt('請輸入 MOQ (最低訂購量):', '0');

  saveMasterToCloud({
    id: Date.now(),
    category: category,
    name: name,
    thickness: thickness,
    size: size,
    safetyStock: Number(safetyStock) || 0,
    moq: Number(moq) || 0
  });
}

async function saveMasterToCloud(master) {
  try {
    const payload = { action: 'saveMaster', master: master };
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === 'success') {
      alert(`成功新增物料主檔：「${master.name}」！`);
      fetchInventoryData();
    } else {
      alert('儲存主檔失敗');
    }
  } catch (e) {
    alert('網路異常');
  }
}

function editMaster(id) {
  let item = inventoryData.find(i => String(i.id) === String(id));
  if (!item) return;
  let category = prompt('修改分類:', item.category);
  let thickness = prompt('修改厚度:', item.thickness);
  let size = prompt('修改尺寸:', item.size);
  let safetyStock = prompt('修改安全庫存:', item.safetyStock);
  let moq = prompt('修改 MOQ:', item.moq);

  saveMasterToCloud({
    id: item.id,
    category: category || item.category,
    name: item.name,
    thickness: thickness || item.thickness,
    size: size || item.size,
    safetyStock: Number(safetyStock) || 0,
    moq: Number(moq) || 0
  });
}
