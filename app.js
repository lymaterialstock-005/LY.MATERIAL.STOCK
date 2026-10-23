/**
 * 全面雲端化入出庫兼採購系統 - app.js
 * 完美結合您的完整介面邏輯與 Google 雲端試算表後端
 */

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1dHo2tUXua5hRPYxdKy7T7HmZ8wLdpZxrZna-matd_xsN6E_QHZ-bOdoudAAt78PsoA/exec";

// 全域狀態變數
let inventoryData = [];
let materialCategories = [
  '德昱興', '華立', '樂榮', '羅傑斯', '昶瑞', '倍速', '好加', '冠好', 
  'PORON', '泡棉', '3M', '國貿', '晉昌', '精強', '靖昌', '頂誌', 
  '慧迅', '金開', '伍豐', '家巧', '樂高', '寶燕', '其他'
];
let currentCategoryFilter = '全部';
let isSummaryCollapsed = false;
let editingMasterId = null;

const $ = id => document.getElementById(id);
const normStr = str => (str || '').toString().trim().toUpperCase();

document.addEventListener("DOMContentLoaded", () => {
  initSystem();
});

/**
 * 系統初始化
 */
function initSystem() {
  console.log("系統初始化完成。");
  fetchInventoryData();
  setupEventListeners();
}

/**
 * 從 Google 試算表載入物料與庫存資料
 */
async function fetchInventoryData() {
  try {
    showLoading(true);
    let response = await fetch(GAS_WEB_APP_URL + "?action=getInventory");
    let result = await response.json();
    
    if (result && result.data) {
      inventoryData = result.data;
      
      // 動態提取不重複的分類
      const dynamicCats = [...new Set(inventoryData.map(item => item.category))];
      dynamicCats.forEach(c => {
        if (c && !materialCategories.includes(c)) materialCategories.push(c);
      });

      renderCategoryChips();
      loadStockSummary();
    }
  } catch (error) {
    console.error("載入物料資料失敗：", error);
    alert("無法連線至雲端資料庫，請檢查網路或 GAS 設定。");
  } finally {
    showLoading(false);
  }
}

/**
 * 渲染分類標籤
 */
function renderCategoryChips() {
  const container = $('categoryChips');
  if (!container) return;

  let html = `<button type="button" class="chip ${currentCategoryFilter === '全部' ? 'active' : ''}" data-cat="全部">全部</button>`;
  html += `<button type="button" class="chip ${currentCategoryFilter === 'WARN' ? 'active' : ''}" data-cat="WARN">⚠️ 庫存過低</button>`;

  materialCategories.forEach(cat => {
    html += `<button type="button" class="chip ${currentCategoryFilter === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`;
  });

  container.innerHTML = html;
}

/**
 * 載入庫存摘要與卡片清單
 */
function loadStockSummary() {
  const summaryDiv = $('inventoryStockSummary');
  if (!summaryDiv) return;

  let filtered = inventoryData;
  if (currentCategoryFilter === 'WARN') {
    filtered = inventoryData.filter(item => Number(item.stock) <= Number(item.safeStock));
  } else if (currentCategoryFilter !== '全部') {
    filtered = inventoryData.filter(item => item.category === currentCategoryFilter);
  }

  // 搜尋關鍵字過濾
  const searchInput = $('search-input');
  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (keyword) {
    filtered = filtered.filter(item => item.name.toLowerCase().includes(keyword));
  }

  if (filtered.length === 0) {
    summaryDiv.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">目前沒有符合的物料資料（請點擊「+」新增主檔或至 Google 試算表新增）</div>`;
    return;
  }

  summaryDiv.innerHTML = filtered.map(item => {
    const isLowStock = Number(item.stock) <= Number(item.safeStock);
    const statusClass = isLowStock ? 'k-warn' : 'k-ok';

    return `
      <div class="card stock-card-item ${statusClass}" data-name="${item.name}" data-thickness="${item.thickness || ''}" style="margin-bottom: 8px; padding: 12px; cursor: pointer; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: bold; font-size: 15px;">${item.name} ${item.thickness ? '(' + item.thickness + 'mm)' : ''}</div>
          <div style="font-size: 13px; color: ${isLowStock ? '#ef4444' : '#10b981'}; font-weight: bold;">庫存：${item.stock} ${item.unit || '片'}</div>
        </div>
        <div style="font-size: 12px; color: #aaa; margin-top: 4px;">分類：${item.category} | 規格：${item.size || '無'} | 安全庫存：${item.safeStock}</div>
      </div>
    `;
  }).join("");
}

/**
 * 設定所有按鈕與事件監聽
 */
function setupEventListeners() {
  // 1. 搜尋列篩選
  const searchInput = $('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      loadStockSummary();
    });
  }

  // 2. 分類晶片點擊
  const categoryChips = $('categoryChips');
  if (categoryChips) {
    categoryChips.addEventListener('click', e => {
      if (e.target.classList.contains('chip')) {
        currentCategoryFilter = e.target.getAttribute('data-cat');
        isSummaryCollapsed = false;
        $('inventoryStockSummary').style.display = 'block';
        const toggleBtn = $('btnToggleSummary');
        if (toggleBtn) toggleBtn.innerText = '收起 ▲';

        renderCategoryChips();
        loadStockSummary();
      }
    });
  }

  // 3. 收起/展開摘要按鈕
  const btnToggleSummary = $('btnToggleSummary');
  if (btnToggleSummary) {
    btnToggleSummary.addEventListener('click', () => {
      isSummaryCollapsed = !isSummaryCollapsed;
      const summaryDiv = $('inventoryStockSummary');
      if (isSummaryCollapsed) {
        summaryDiv.style.display = 'none';
        btnToggleSummary.innerText = '展開 ▼';
      } else {
        summaryDiv.style.display = 'block';
        btnToggleSummary.innerText = '收起 ▲';
      }
    });
  }

  // 4. 「+」快捷新增主檔按鈕
  const btnAddMasterQuick = $('btnAddMasterQuick');
  if (btnAddMasterQuick) {
    btnAddMasterQuick.addEventListener('click', () => {
      const currentName = $('txMaterialName') ? $('txMaterialName').value : '';
      const currentThick = $('txThickness') ? $('txThickness').value : '';
      openMasterModal(currentName, currentThick);
    });
  }

  // 5. 關閉主檔視窗
  const btnCloseMaster = $('btnCloseMaster');
  if (btnCloseMaster) {
    btnCloseMaster.addEventListener('click', closeMasterModal);
  }

  // 6. 儲存新主檔至雲端
  const btnSaveNewMaster = $('btnSaveNewMaster');
  if (btnSaveNewMaster) {
    btnSaveNewMaster.addEventListener('click', saveNewMasterToCloud);
  }

  // 7. 點擊卡片帶入異動表單
  document.addEventListener('click', e => {
    const card = e.target.closest('.stock-card-item');
    if (card) {
      const name = card.getAttribute('data-name');
      const thickness = card.getAttribute('data-thickness');
      selectItemToTransaction(name, thickness);
    }
  });

  // 8. 入庫 / 出庫按鈕
  const btnIn = $('btnIn') || $('btn-in');
  const btnOut = $('btnOut') || $('btn-out');

  if (btnIn) btnIn.addEventListener('click', () => handleTransaction('IN'));
  if (btnOut) btnOut.addEventListener('click', () => handleTransaction('OUT'));
}

/**
 * 選取物料帶入交易表單
 */
function selectItemToTransaction(name, thickness) {
  const nameInput = $('txMaterialName') || $('form-item-name');
  const thickInput = $('txThickness');
  
  if (nameInput) nameInput.value = name;
  if (thickInput && thickness) thickInput.value = thickness;

  // 自動捲動到異動表單區
  const txCard = $('txCard');
  if (txCard) {
    txCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * 開啟主檔編輯 Modal
 */
function openMasterModal(defaultName = '', defaultThickness = '') {
  const modal = $('masterModal');
  if ($('newMasterName')) $('newMasterName').value = defaultName;
  if ($('newMasterThickness')) $('newMasterThickness').value = defaultThickness;
  
  if (modal) {
    modal.style.display = 'flex';
  } else {
    // 若無 Modal 則用 prompt 替代
    let name = prompt("請輸入物料名稱：", defaultName);
    if (name && name.trim()) {
      let category = prompt("請輸入分類（如：德昱興、華立等）：", "其他");
      saveMasterDirectly(category || "其他", name.trim());
    }
  }
}

function closeMasterModal() {
  const modal = $('masterModal');
  if (modal) modal.style.display = 'none';
}

/**
 * 儲存新主檔至雲端試算表
 */
async function saveNewMasterToCloud() {
  const name = $('newMasterName') ? normStr($('newMasterName').value) : '';
  const category = $('newMasterCategory') ? $('newMasterCategory').value : '其他';
  const thickness = $('newMasterThickness') ? normStr($('newMasterThickness').value) : '';
  const size = $('newMasterSize') ? normStr($('newMasterSize').value) : '';
  const safeStock = $('newMasterSafetyStock') ? Number($('newMasterSafetyStock').value) || 0 : 5;
  const moq = $('newMasterMoq') ? Number($('newMasterMoq').value) || 0 : 1;

  if (!name) {
    alert('請輸入品名！');
    return;
  }

  await saveMasterDirectly(category, name, thickness, size, safeStock, moq);
  closeMasterModal();
}

async function saveMasterDirectly(category, name, thickness = '', size = '', safeStock = 5, moq = 1) {
  const payload = {
    action: "saveMaster",
    category: category,
    name: name,
    thickness: thickness,
    size: size,
    safeStock: safeStock,
    moq: moq
  };

  try {
    showLoading(true);
    let response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let result = await response.json();
    if (result.status === "success") {
      alert(`✅ 成功儲存物料主檔：「${name}」至雲端！`);
      fetchInventoryData();
    } else {
      alert("儲存失敗：" + (result.message || "未知錯誤"));
    }
  } catch (err) {
    console.error("儲存主檔錯誤：", err);
    alert("連線雲端失敗。");
  } finally {
    showLoading(false);
  }
}

/**
 * 處理入庫 / 出庫交易
 */
async function handleTransaction(type) {
  const nameInput = $('txMaterialName') || $('form-item-name');
  const thickInput = $('txThickness');
  const qtyInput = $('txQty') || $('form-quantity');

  const materialName = nameInput ? nameInput.value.trim() : '';
  const thickness = thickInput ? thickInput.value.trim() : '';
  const qty = qtyInput ? Number(qtyInput.value) : 0;

  if (!materialName || !qty || qty <= 0) {
    alert('請填寫完整的物料名稱與有效的數量！');
    return;
  }

  const payload = {
    action: "transaction",
    type: type, // "IN" 或 "OUT"
    itemName: materialName,
    thickness: thickness,
    quantity: qty,
    timestamp: new Date().toISOString()
  };

  try {
    showLoading(true);
    let response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let result = await response.json();
    if (result.status === "success") {
      alert(type === 'IN' ? `✅ 入庫成功：${materialName} +${qty}` : `✅ 出庫成功：${materialName} -${qty}`);
      
      if (qtyInput) qtyInput.value = '';
      fetchInventoryData();
    } else {
      alert("交易失敗：" + (result.message || "未知錯誤"));
    }
  } catch (error) {
    console.error("送出交易失敗：", error);
    alert("網路連線異常，送出失敗。");
  } finally {
    showLoading(false);
  }
}

/**
 * 載入中狀態提示
 */
function showLoading(isLoading) {
  const bar = $('status-bar');
  if (bar) {
    bar.innerText = isLoading ? '⏳ 正在同步雲端資料...' : '🟢 系統就緒';
    bar.style.backgroundColor = isLoading ? '#d97706' : '#166534';
  }
}
