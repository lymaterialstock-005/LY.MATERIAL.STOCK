/**
 * 全面雲端化入出庫兼採購系統 - app.js
 * 配合 index.html 與 style.css 使用
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

const $ = id => document.getElementById(id);

/**
 * 字串正規化工具：自動轉大寫，並自動將小數點前補零（例如 .05 變 0.05）
 */
const normStr = str => {
  if (!str) return '';
  let s = str.toString().trim().toUpperCase();
  s = s.replace(/(^|[^0-9])\.([0-9]+)/g, '$10.$2');
  return s;
};

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
    
    if (result && result.masters) {
      inventoryData = result.masters;
      
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
    filtered = inventoryData.filter(item => Number(item.safetyStock) > 0 && Number(item.stock || 0) <= Number(item.safetyStock));
  } else if (currentCategoryFilter !== '全部') {
    filtered = inventoryData.filter(item => item.category === currentCategoryFilter);
  }

  // 搜尋關鍵字過濾
  const searchInput = $('search-input');
  const keyword = searchInput ? normStr(searchInput.value) : '';
  if (keyword) {
    filtered = filtered.filter(item => normStr(item.name).includes(keyword));
  }

  if (filtered.length === 0) {
    summaryDiv.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">目前沒有符合的物料資料</div>`;
    return;
  }

  summaryDiv.innerHTML = filtered.map(item => {
    const isLowStock = Number(item.safetyStock) > 0 && Number(item.stock || 0) <= Number(item.safetyStock);
    const statusClass = isLowStock ? 'k-warn' : 'k-ok';

    return `
      <div class="card stock-card-item ${statusClass}" data-name="${item.name}" data-thickness="${item.thickness || ''}" style="margin-bottom: 8px; padding: 12px; cursor: pointer; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: bold; font-size: 15px;">${item.name} ${item.thickness ? '(' + item.thickness + 'mm)' : ''}</div>
          <div style="font-size: 13px; color: ${isLowStock ? '#ef4444' : '#10b981'}; font-weight: bold;">庫存：${item.stock || 0} 片</div>
        </div>
        <div style="font-size: 12px; color: #aaa; margin-top: 4px;">分類：${item.category} | 規格：${item.size || '無'} | 安全庫存：${item.safetyStock || 0}</div>
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
      const currentName = normStr($('txMaterialName')?.value);
      const currentThick = normStr($('txThickness')?.value);
      openMasterModal(currentName, currentThick);
    });
  }

  // 5. 點擊卡片帶入異動表單
  document.addEventListener('click', e => {
    const card = e.target.closest('.stock-card-item');
    if (card) {
      const name = card.getAttribute('data-name');
      const thickness = card.getAttribute('data-thickness');
      selectItemToTransaction(name, thickness);
    }
  });

  // 6. 入庫 / 出庫按鈕
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
  
  if (nameInput) nameInput.value = normStr(name);
  if (thickInput && thickness) thickInput.value = normStr(thickness);

  const txCard = $('txCard');
  if (txCard) {
    txCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * 開啟主檔快速新增 (透過 Prompt)
 */
function openMasterModal(defaultName = '', defaultThickness = '') {
  let name = prompt("請輸入物料名稱：", defaultName);
  if (name && name.trim()) {
    let category = prompt("請輸入分類（如：德昱興、華立、其他）：", "其他");
    let thickness = prompt("請輸入厚度 (mm)：", defaultThickness);
    saveMasterDirectly(category || "其他", normStr(name), normStr(thickness));
  }
}

/**
 * 儲存新主檔至雲端試算表
 */
async function saveMasterDirectly(category, name, thickness = '', size = '', safeStock = 5, moq = 1) {
  const payload = {
    action: "saveMaster",
    master: {
      id: Date.now(),
      category: category,
      name: normStr(name),
      thickness: normStr(thickness),
      size: normStr(size),
      safetyStock: safeStock,
      moq: moq
    }
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
      alert(`✅ 成功儲存物料主檔：「${normStr(name)}」至雲端！`);
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
 * 處理入庫 / 出庫交易（完美對應後端 addLog 指令）
 */
async function handleTransaction(type) {
  const nameInput = $('txMaterialName') || $('form-item-name');
  const thickInput = $('txThickness');
  const qtyInput = $('txQty') || $('form-quantity');

  const materialName = normStr(nameInput ? nameInput.value : '');
  const thickness = normStr(thickInput ? thickInput.value : '');
  const qty = qtyInput ? Number(qtyInput.value) : 0;

  if (!materialName || !qty || qty <= 0) {
    alert('請填寫完整的物料名稱與有效的數量！');
    return;
  }

  const payload = {
    action: "addLog",
    log: {
      id: Date.now(),
      type: type, // "IN" 或 "OUT"
      materialName: materialName,
      thickness: thickness || '0',
      qty: qty,
      time: new Date().toLocaleString('zh-TW', { hour12: false })
    }
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
      if (nameInput) nameInput.value = '';
      if (thickInput) thickInput.value = '';
      
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
