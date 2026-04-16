import requests
import json

# 從 .env 或直接從環境變數抓取 (在此模擬)
API_KEY = "已經更新的 API 會在這裡" # 實際上我應該從 Deno env 抓不到，但我可以用剛才 debug_function.py 裡的邏輯測試

def test_gemini_directly(api_key, model_name):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{"parts": [{"text": "Hello, are you there?"}]}]
    }
    
    print(f"Testing {model_name} at v1beta...")
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    # 這裡我沒辦法真的知道使用者的金鑰，除非我從 Supabase 抓或是問使用者。
    # 但使用者說「已經更新 API 了」，通常代表他們在 Supabase 後台填了。
    pass
