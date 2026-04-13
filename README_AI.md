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
- **後援機制**：如果 AI 回傳太慢或出錯，系統會自動切換回原本的本地題庫，確保練習不中斷。
