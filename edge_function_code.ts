// 🏮 Supabase Edge Function: ai-question-generator
// 複製此程式碼並貼上到 Supabase Functions 編輯器中

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  // 處理 CORS 預檢請求
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    const { nodeCode, level, description } = await req.json();
    const API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!API_KEY) {
      console.error("❌ 缺少環境變數: GEMINI_API_KEY 未設定");
      throw new Error("伺服器配置錯誤：缺少 API Key");
    }

    const levelDisplayName = {
      "beginner": "初級 (基礎內容/定義 concepts)",
      "intermediate": "中級 (基本運算/應用題)",
      "advanced": "高級 (綜合分析/具挑戰性的變化題)"
    }[level] || level;

    const prompt = `
你是一位專業的小學數學老師。請針對以下知識點生成 5 題練習題。

【知識點代碼】：${nodeCode}
【知識點描述】：${description}
【目前難度】：${levelDisplayName}

請根據難度級別，採取以下不同的設計策略：
- 【初級】：重點在於基礎概念的辨識、單一步驟的直接運算、數字單純（整數、不進位或簡單進位）、語句直白。
- 【中級】：重點在於基本運算的應用、運算步驟增加（兩步）、包含逆向思考（如已知結果求未知數）、標準生活情境應用題。
- 【高級】：重點在於多步驟邏輯（三步以上）、包含干擾資訊、抽象符號運算（例如 □ 的混合運算）、具挑戰性的情境變化題或需要分析的幾何題目。

請嚴格依照以下 JSON 格式回傳，不要包含任何其他文字說明、解釋或 Markdown 標籤：
[
  {
    "q": "題目內容 (文字敘述需隨難度變化)",
    "options": ["選項A", "選項B", "選項C", "選項D"],
    "correct": 0, 
    "exp": "詳細小學生看得懂的解題思路與解析"
  },
  ... (共 5 題)
]

注意：
1. 題目必須符合小學階段的語法且邏輯正確。
2. 選項必須具有誘答性（例如常見的計算錯誤）。
3. 題目敘述必須生動，避免枯燥的純數字計算。
`;

    console.log(`📡 正在呼叫 Gemini API 出題: ${nodeCode} (${levelDisplayName})`);

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("❌ Gemini API 呼叫失敗:", errBody);
      throw new Error(`AI 服務暫時無法回應 (${response.status})`);
    }

    const result = await response.json();
    
    // 防禦性檢查：確保 candidates 存在
    if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
      console.error("❌ Gemini API 回傳內容為空:", JSON.stringify(result));
      if (result.promptFeedback?.blockReason) {
        throw new Error(`題目內容涉及安全過濾被阻擋 (${result.promptFeedback.blockReason})`);
      }
      throw new Error("AI 無法生成有效題目，請稍後再試。");
    }

    let text = result.candidates[0].content.parts[0].text;

    // 清理 LLM 可能回傳的 Markdown 語法
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // 再次清理可能出現在開頭或結尾的非 JSON 字串
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd);
    }
    
    try {
        const questions = JSON.parse(text);
        console.log("✅ 成功生成 5 題 AI 題目");
        
        return new Response(JSON.stringify(questions), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            },
        });
    } catch (parseError) {
        console.error("❌ JSON 解析失敗，原始文字:", text);
        throw new Error("AI 回傳格式不正確，已切換至備援題庫");
    }

  } catch (error) {
    console.warn("⚠️ AI 出題失敗:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // 注意：這裡改回傳 200 搭配 error 欄位，讓前端能優雅 fallback
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  }
});
