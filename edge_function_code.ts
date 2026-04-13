// 🏮 Supabase Edge Function: ai-question-generator
// 複製此程式碼並貼上到 Supabase Functions 編輯器中

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

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
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const levelDisplayName = {
      "beginner": "初級 (基礎、定義概念)",
      "intermediate": "中級 (計算、應用題)",
      "advanced": "高級 (綜合分析、挑戰題)"
    }[level] || level;

    const prompt = `
你是一位專業的小學數學老師。請針對以下知識點生成 5 題練習題。

【知識點代碼】：${nodeCode}
【知識點描述】：${description}
【目前難度】：${levelDisplayName}

請嚴格依照以下 JSON 格式回傳，不要包含任何其他文字說明或 Markdown 標籤：
[
  {
    "q": "題目內容",
    "options": ["選項A", "選項B", "選項C", "選項D"],
    "correct": 0, // 正確答案在 options 中的索引 (0-3)
    "exp": "詳細的解題思路與解析"
  },
  ... (共 5 題)
]

注意：
1. 題目必須符合小學生的語文理解程度。
2. 選項必須具有誘答性，不要太過明顯。
3. 解析內容要清楚、溫暖、具鼓勵性。
4. 務必輸出純 JSON 陣列。
`;

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
      }),
    });

    const result = await response.json();
    let text = result.candidates[0].content.parts[0].text;

    // 清理可能出現的 Markdown 標籤
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const questions = JSON.parse(text);

    return new Response(JSON.stringify(questions), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  }
});
