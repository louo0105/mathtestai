import requests
import json

# 請填入您的 Groq API Key
GROQ_API_KEY = "gsk_..." 

def test_groq_directly():
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": "你是一位老師，請出 1 題小學數學加法題，並以 JSON 回傳，格式為: {'q': '...', 'options': ['A','B','C','D'], 'correct': 0, 'exp': '...'}"}
        ],
        "response_format": { "type": "json_object" }
    }
    
    print("Testing Groq API Connectivity...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("✅ Success! AI Output:")
            print(json.dumps(result['choices'][0]['message']['content'], indent=2, ensure_ascii=False))
        else:
            print(f"❌ Failed: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if GROQ_API_KEY == "gsk_...":
        print("⚠️ 請先將您的 Groq API Key 填入腳本中的 GROQ_API_KEY 變數中。")
    else:
        test_groq_directly()
