# 🏮 考古題練習系統 - AI 安全升級版指南

本版本為您新增了 **線上 AI 即時出題** 功能。為了確保安全，我們使用了 Supabase Edge Functions 技術來隱藏您的 Google Gemini API 金鑰。

## 🚀 設定步驟 (只需一次)

### 第一步：初始化資料庫
1. 請開啟您的 [Supabase 專案控制台](https://supabase.com/dashboard)。
2. 點擊左側的 **SQL Editor**。
3. 建立一個 **New Query**，並將 `setup.sql` 檔案中的內容貼上。
4. 點擊 **Run**。這會建立用於存放 AI 開關的表格。

### 第二步：建立雲端出題函數 (Edge Function)
1. 在 Supabase 控制台點擊左側的 **Functions**。
2. 點擊 **Create a new function**。
3. 將函數名稱命名為：`ai-question-generator`。
4. 在編輯器中，將我稍後為您準備的 `edge_function_code.ts` 內容完整貼上。

### 第三步：設定您的 API 金鑰 (極重要)
1. 到 [Google AI Studio](https://aistudio.google.com/app/apikey) 點擊 **Create API key**。
2. 複製那串金鑰。
3. 回到 Supabase -> Functions -> `ai-question-generator`。
4. 點擊 **Settings** 或 **Environment Variables**。
5. 新增一個變數：
   - **Name**: `GEMINI_API_KEY`
   - **Value**: (貼上剛才從 Google 複製的金鑰)
6. 點擊 **Save**。

---

## 🛠 如何使用
- **開啟 AI 模式**：以 `admin` 帳號登入系統，進入「教師管理後台」，您會看到一個新的切換開關「啟用線上 AI 無限出題」。
- **學生體驗**：當開關開啟時，學生點擊練習節點，系統會顯示「AI 正在為您出題...」，並即時從雲端獲取 5 題全新的題目。
---

## 🧠 題庫擴充與維護技能 (Skill Set)

為了維持系統 100% 的知識點覆蓋率 (各節點 >= 10 題)，請遵循以下經過實戰驗證的工作流：

### 1. 缺陷稽核 (Audit Driven)
- **工具**：`scratch/full_audit.py`
- **操作**：定期執行此腳本來檢視題量不足的節點。
- **技巧**：可修改腳本中的 `total < 10` 門檻來動態設定擴展目標。

### 2. 高品質產題策略 (Story-Based Generation)
- **標準**：所有擴充題目應具備**故事場景**、**高品質解釋 (exp)** 與**合理干擾項**。
- **批次處理**：建議以 5-10 個節點為一批次 (Batch) 進行生成，避免超長文本導致的解析錯誤或品質下降。

### 3. 安全合併工作流 (Incremental Merge)
- **工具**：`scratch/merge_expansion.py`
- **關鍵**：務必確保腳本使用的是 **「增量附加 (Append)」** 邏輯。這能讓你將新題目直接補進 `extra_data.js` 的現有列表中，而不會覆蓋掉已存在的優質題目。

### 4. 題庫品質防線 (Data Integrity)
- **工具**：`scratch/cleanup_duplicates.py`
- **場景**：在多次執行批次合併後，執行此腳本來移除重複題目。
- **重點**：這能保持 `extra_data.js` 的體積精簡，並確保正式稽核數據的準確性。

### 5. Regex 安全規範
- **維護代碼**：編輯 `extra_data.js` 時應避免使用貪婪匹配的正規表達式 (如 `.*`)，改用更精確的匹配方式以防止檔案截斷。

---
*本文件由 AI 助手於 2026-04-20 彙整更新，旨在確保題庫的長期健康與 100% 覆蓋率。*
