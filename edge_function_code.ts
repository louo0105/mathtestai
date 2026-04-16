import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];

async function tryGenerate(model, apiKey, prompt) {
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
    throw new Error(err.error?.message || "API 無回應");
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
    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) throw new Error("缺少 API KEY Secret");

    const prompt = `你是一位專業數學老師，請針對知識點 [${nodeCode}: ${description}] 生成 5 題 [${level}] 難度的數學練習題。請嚴格以 JSON 陣列回傳，包含 q, options, correct, exp。不要包含 Markdown。`;

    let text = "";
    let lastError = "";

    for (const model of MODELS) {
      try {
        console.log(`📡 嘗試使用模型: ${model}`);
        text = await tryGenerate(model, API_KEY, prompt);
        if (text) break;
      } catch (err) {
        lastError = err.message;
        console.warn(`${model} 失敗: ${lastError}`);
      }
    }

    if (!text) throw new Error("所有備援模型皆不可用: " + lastError);

    // JSON 格式化處理
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']') + 1;
    if (startIdx !== -1 && endIdx > 0) text = text.substring(startIdx, endIdx);

    const questions = JSON.parse(text);
    return new Response(JSON.stringify(questions), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
