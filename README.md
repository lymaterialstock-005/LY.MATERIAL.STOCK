<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>物料庫存</title>

    <!-- 載入外部 CSS -->
    <link rel="stylesheet" href="style.css">

    <!-- 手機版 Console 除錯工具 (Eruda) -->
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
</head>
<body>

    <div id="status-bar">⏳ 正在連線至雲端資料庫...</div>

    <h2>
        <span>📊 庫存明細</span>
        <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" id="btnOpenCatModal" class="btn-text-link" style="color: #f87171; font-size: 12px;">🗑️ 批次刪除</button>
            <button type="button" id="btnToggleSummary" class="btn-text-link">收起 ▲</button>
        </div>
    </h2>

    <!-- 快選物料分類標籤列 -->
    <div id="categoryChips" class="chips-container"></div>

    <!-- 庫存明細清單區塊 -->
    <div id="inventoryStockSummary" style="padding: 0 12px; margin-bottom: 16px;"></div>

    <h2>📝 物料入出庫異動</h2>
    <div class="card" id="txCard">
        <div class="form-group">
            <label>1. 物料名稱</label>
            <div class="search-container">
                <input type="text" id="txMaterialName" placeholder="點擊上方快選或明細可直接帶入品名" style="flex: 1;">
                <button type="button" id="btnAddMasterQuick" class="btn-icon" title="新增物料主檔" style="padding: 8px 14px; font-size: 18px;">＋</button>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>2. 厚度 (mm)</label>
                <input type="text" id="txThickness" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>3. 數量</label>
                <input type="number" id="txQty" placeholder="0">
            </div>
        </div>
        <div class="btn-group">
            <button type="button" class="btn btn-in" id="btnIn">📥 入庫</button>
            <button type="button" class="btn btn-out" id="btnOut">📤 出庫</button>
        </div>
    </div>

    <!-- 物料主檔 Modal -->
    <div id="masterModal" class="modal">
        <div class="modal-content" id="masterModalContent">
            <div class="modal-header">
                <span class="modal-title" id="masterModalHeaderTitle">📦 物料主檔管理</span>
                <button type="button" class="close-btn" id="btnCloseMaster">&times;</button>
            </div>

            <!-- 主檔編輯與新增表單區塊 -->
            <div id="masterFormSection">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span id="masterFormTitle" style="font-size: 13px; font-weight: bold; color: #3b82f6;">✏️ 新增物料主檔</span>
                    <button type="button" id="btnCancelEditMaster" class="btn-text-link" style="display: none;">⬅️ 返回</button>
                </div>

                <div id="editingBadge" style="display: none; background: #2c2c2c; padding: 6px 10px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 8px; font-size: 11px; color: #fbbf24;"></div>

                <!-- 物料名稱 -->
                <div class="form-group">
                    <label>物料名稱</label>
                    <input type="text" id="newMasterName" placeholder="物料名稱 (如: 1870A)">
                </div>

                <!-- 物料分類 -->
                <div class="form-group">
                    <label>物料分類</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="newMasterCategory" readonly placeholder="請選擇分類" style="flex: 1; background: #2c2c2c; cursor: pointer;" value="其他">
                        <button type="button" id="btnOpenCategoryPicker" style="background: #2563eb; color: white; border: none; padding: 0 14px; border-radius: 6px; font-weight: bold; cursor: pointer; white-space: nowrap;">選擇分類</button>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <input type="text" id="newMasterThickness" placeholder="厚度 (如: 0.125)">
                    </div>
                    <div class="form-group">
                        <input type="text" id="newMasterSize" placeholder="尺寸 (如: 930X680M)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>安全庫存</label>
                        <input type="number" id="newMasterSafetyStock" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>MOQ (最低訂購量)</label>
                        <input type="number" id="newMasterMoq" placeholder="0">
                    </div>
                </div>
                <button type="button" id="btnSaveNewMaster" style="width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 4px; font-size: 14px;">儲存至物料主檔</button>
            </div>
        </div>
    </div>

    <!-- 物料分類快選彈窗 (Modal Picker) -->
    <div id="categoryPickerModal" class="modal">
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <span class="modal-title">📂 選擇物料分類</span>
                <button type="button" class="close-btn" id="btnCloseCategoryPicker">&times;</button>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">請點擊選擇分類，或點下方按鈕新增分類：</div>
            <div id="categoryPickerGrid" style="max-height: 40vh; overflow-y: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;"></div>
            <button type="button" id="btnAddCustomCategory" style="width: 100%; padding: 10px; background: #166534; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;">➕ 新增自定義分類</button>
        </div>
    </div>

    <!-- 分類複選刪除 Modal -->
    <div id="catBatchModal" class="modal">
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <span class="modal-title">🗑️ 批次勾選要刪除的分類</span>
                <button type="button" class="close-btn" id="btnCloseCatBatchModal">&times;</button>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">勾選要刪除的分類（將連同該分類下所有物料主檔一併刪除）：</div>
            <div id="catCheckboxList" style="max-height: 40vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;"></div>
            <button type="button" id="btnConfirmBatchDelete" style="width: 100%; padding: 10px; background: #c62828; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;">確認刪除勾選的分類</button>
        </div>
    </div>

    <!-- 載入外部 JavaScript -->
    <script src="app.js"></script>
</body>
</html>
