import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function tryGroq(apiKey, prompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Groq API 無回應");
  }
  
  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

async function tryGemini(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 }
    })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Gemini API 無回應");
  }
  
  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
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
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const prompt = `你是一位專業數學老師，請針對知識點 [${nodeCode}: ${description}] 生成 5 題 [${level}] 難度的數學練習題。
請嚴格以 JSON 格式回傳，格式為：{"questions": [{"q": "題目", "options": ["A", "B", "C", "D"], "correct": 0, "exp": "解析"}]}
其中 correct 為正確選項的索引(0-3)。回傳純 JSON。`;

    let text = "";
    let lastError = "";

    // 優先嘗試 Groq
    if (GROQ_API_KEY) {
      try {
        console.log(`📡 嘗試使用 Groq 模型: ${GROQ_MODEL}`);
        text = await tryGroq(GROQ_API_KEY, prompt);
      } catch (err) {
        lastError = `Groq 失敗: ${err.message}`;
        console.warn(lastError);
      }
    }

    // 若 Groq 失敗或未設定，嘗試 Gemini
    if (!text && GEMINI_API_KEY) {
      for (const model of GEMINI_MODELS) {
        try {
          console.log(`📡 轉向嘗試 Gemini 模型: ${model}`);
          text = await tryGemini(model, GEMINI_API_KEY, prompt);
          if (text) break;
        } catch (err) {
          lastError = `Gemini ${model} 失敗: ${err.message}`;
          console.warn(lastError);
        }
      }
    }

    if (!text) throw new Error("所有 AI 服務皆不可用: " + lastError);

    // JSON 格式化處理
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}') + 1;
    if (startIdx !== -1 && endIdx > 0) text = text.substring(startIdx, endIdx);

    const parsed = JSON.parse(text);
    const questions = parsed.questions || parsed; // 相容不同的 JSON 結構

    return new Response(JSON.stringify(questions), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (error) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});

