import requests
import json

SUPABASE_URL = 'https://qvepxxnikggexobibsvw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZXB4eG5pa2dnZXhvYmlic3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzk1OTQsImV4cCI6MjA5MTYxNTU5NH0.XZ44sLqdgtQ9UMx2mNZfI-SyxwRVXQFNr90kpGdrFWE'

def test_supabase():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print(f"Testing connection to {SUPABASE_URL}...")
    
    # Check app_settings
    try:
        response = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?select=*", headers=headers)
        if response.status_code == 200:
            print("Successfully fetched app_settings:", response.json())
        else:
            print(f"Failed to fetch app_settings: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")

    # Check edge function (if it exists)
    # We can't easily check existence without calling it, which requires payload
    payload = {
        "nodeCode": "TEST",
        "level": "beginner",
        "description": "測試題目"
    }
    try:
        print("Testing Edge Function 'ai-question-generator'...")
        response = requests.post(f"{SUPABASE_URL}/functions/v1/ai-question-generator", headers=headers, json=payload)
        if response.status_code == 200:
            print("Edge Function exists and works!")
        else:
            print(f"Edge Function error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error calling Edge Function: {e}")

if __name__ == "__main__":
    test_supabase()
