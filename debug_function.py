import requests
import json

URL = 'https://qvepxxnikggexobibsvw.supabase.co'
KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZXB4eG5pa2dnZXhvYmlic3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzk1OTQsImV4cCI6MjA5MTYxNTU5NH0.XZ44sLqdgtQ9UMx2mNZfI-SyxwRVXQFNr90kpGdrFWE'

def debug_function():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "nodeCode": "TEST-101",
        "level": "beginner",
        "description": "測試題目生成"
    }
    
    print(f"Calling Edge Function at {URL}...")
    try:
        response = requests.post(f"{URL}/functions/v1/ai-question-generator", headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_function()
