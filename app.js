/**
 * 全面雲端化入出庫兼採購系統 - app.js
 * 配合 index.html 與 style.css 使用
 */

// 已內嵌您的最新正式 GAS 部署網址
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1dHo2tUXua5hRPYxdKy7T7HmZ8wLdpZxrZna-matd_xsN6E_QHZ-bOdoudAAt78PsoA/exec";

// 全域狀態變數
let inventoryData = [];
let currentCategory = "全部";

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

/**
 * 初始化應用程式
 */
function initApp() {
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
      renderCategoryChips(inventoryData);
      renderInventoryList(inventoryData);
    }
  } catch (error) {
    console.error("載入物料資料失敗：", error);
    alert("無法連線至雲端資料庫，請檢查網路或 GAS 設定。");
  } finally {
    showLoading(false);
  }
}

/**
 * 設定所有按鈕與輸入框的事件監聽
 */
function setupEventListeners() {
  // 搜尋列即時篩選
  const searchInput = document.querySelector("#search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      filterAndRender(keyword, currentCategory);
    });
  }

  // 綁定入庫/出庫按鈕事件
  const inBtn = document.querySelector("#btn-in");
  const outBtn = document.querySelector("#btn-out");

  if (inBtn) {
    inBtn.addEventListener("click", () => handleTransaction("IN"));
  }
  if (outBtn) {
    outBtn.addEventListener("click", () => handleTransaction("OUT"));
  }
}

/**
 * 渲染分類標籤 (Category Chips)
 */
function renderCategoryChips(data) {
  const container = document.querySelector("#categoryChips");
  if (!container) return;

  // 提取所有不重複的分類
  const categories = ["全部", ...new Set(data.map(item => item.category))];
  
  container.innerHTML = categories.map(cat => `
    <button type="button" class="chip-btn ${cat === currentCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join("");

  // 綁定點擊事件
  container.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      container.querySelectorAll(".chip-btn").forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute("data-category");
      
      const keyword = document.querySelector("#search-input")?.value.trim().toLowerCase() || "";
      filterAndRender(keyword, currentCategory);
    });
  });
}

/**
 * 渲染物料清單卡片
 */
function renderInventoryList(data) {
  const stackContainer = document.querySelector("#inventoryStack");
  if (!stackContainer) return;

  if (data.length === 0) {
    stackContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">目前沒有物料資料</div>`;
    return;
  }

  stackContainer.innerHTML = data.map(item => {
    // 依據安全庫存判斷警示狀態 (對應 style.css 中的 k-warn 與 k-ok)
    const isLowStock = Number(item.stock) <= Number(item.safeStock);
    const statusClass = isLowStock ? 'k-warn' : 'k-ok';

    return `
      <div class="card k-card-item ${statusClass}" data-id="${item.id}" onclick="selectItem('${item.id}')">
        <div style="font-weight: bold; font-size: 15px;">${item.name}</div>
        <div style="font-size: 12px; color: #aaa; margin-top: 4px;">分類：${item.category} | 庫存：${item.stock} ${item.unit}</div>
      </div>
    `;
  }).join("");
}

/**
 * 根據關鍵字與分類篩選並渲染
 */
function filterAndRender(keyword, category) {
  let filtered = inventoryData;

  if (category !== "全部") {
    filtered = filtered.filter(item => item.category === category);
  }

  if (keyword !== "") {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(keyword) || 
      (item.id && item.id.toLowerCase().includes(keyword))
    );
  }

  renderInventoryList(filtered);
}

/**
 * 點擊物料卡片時觸發選取
 */
function selectItem(itemId) {
  const selected = inventoryData.find(item => item.id === itemId);
  if (!selected) return;
  
  // 將選中的物料填入表單欄位中
  const nameInput = document.querySelector("#form-item-name");
  if (nameInput) nameInput.value = selected.name;
  
  console.log("已選取物料：", selected);
}

/**
 * 處理入庫或出庫動作並送至雲端
 */
async function handleTransaction(type) {
  const itemName = document.querySelector("#form-item-name")?.value.trim();
  const quantity = document.querySelector("#form-quantity")?.value.trim();

  if (!itemName || !quantity) {
    alert("請填寫完整的物料名稱與數量！");
    return;
  }

  const payload = {
    action: "transaction",
    type: type, // "IN" 或 "OUT"
    itemName: itemName,
    quantity: Number(quantity),
    timestamp: new Date().toISOString()
  };

  try {
    showLoading(true);
    let response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let result = await response.json();
    if (result.status === "success") {
      alert(type === "IN" ? "✅ 入庫成功！" : "✅ 出庫成功！");
      // 清空表單並重新載入最新庫存
      document.querySelector("#form-quantity").value = "";
      fetchInventoryData();
    } else {
      alert("操作失敗：" + (result.message || "未知錯誤"));
    }
  } catch (error) {
    console.error("送出交易失敗：", error);
    alert("網路連線異常，送出失敗。");
  } finally {
    showLoading(false);
  }
}

/**
 * 載入中提示輔助函式
 */
function showLoading(isLoading) {
  const statusBar = document.querySelector("#status-bar");
  if (statusBar) {
    statusBar.textContent = isLoading ? "⏳ 正在同步雲端資料..." : "🟢 系統就緒";
  }
}
