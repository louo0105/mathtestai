import requests

URLS = [
    'https://qvepxxnikggexobibsvw.supabase.co',
    'https://nrgasojgdittkjjdaenq.supabase.co'
]

KEYS = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZXB4eG5pa2dnZXhvYmlic3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzk1OTQsImV4cCI6MjA5MTYxNTU5NH0.XZ44sLqdgtQ9UMx2mNZfI-SyxwRVXQFNr90kpGdrFWE',
    'sb_publishable_fAhlNjD3GzLkTXIdoG-qgg_DcMsTMgc'
]

def check(url, key):
    print(f"\nChecking {url}...")
    h = {'apikey': key, 'Authorization': f'Bearer {key}'}
    tables = ['students', 'app_settings', 'quiz_logs', 'practice_progress']
    for t in tables:
        try:
            r = requests.get(f"{url}/rest/v1/{t}?select=*", headers=h)
            print(f"  Table '{t}': {r.status_code}")
        except Exception as e:
            print(f"  Table '{t}': ERROR {e}")
    
    # Check edge function
    try:
        r = requests.post(f"{url}/functions/v1/ai-question-generator", headers=h, json={})
        print(f"  Function 'ai-question-generator': {r.status_code}")
    except Exception as e:
        print(f"  Function 'ai-question-generator': ERROR {e}")

if __name__ == "__main__":
    for i in range(len(URLS)):
        check(URLS[i], KEYS[i])
