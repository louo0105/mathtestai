import pandas as pd
import requests
import json
import re

# 配置
SUPABASE_URL = 'https://qvepxxnikggexobibsvw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZXB4eG5pa2dnZXhvYmlic3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzk1OTQsImV4cCI6MjA5MTYxNTU5NH0.XZ44sLqdgtQ9UMx2mNZfI-SyxwRVXQFNr90kpGdrFWE'
ODS_FILE = '學力檢測考古題 113年學力檢測-5年級數學 25題_任務匯出.ods'

def process_ods():
    print(f"Reading ODS file: {ODS_FILE}...")
    try:
        # 讀取 ODS，引擎使用 odf
        df = pd.read_excel(ODS_FILE, engine='odf')
    except Exception as e:
        print(f"Error reading ODS: {e}")
        return

    # 找出知識點欄位 (通常是 N-x-x 或 S-x-x 開頭)
    node_cols = [c for c in df.columns if re.match(r'[A-Z]-\d+-\d+', str(c))]
    print(f"Detected {len(node_cols)} knowledge nodes.")

    students_data = []
    # 學生資料從第 2 列開始 (索引從 0 開始，所以是 row index 2)
    # 第一欄是姓名/座號字串
    for i in range(2, len(df)):
        row = df.iloc[i]
        raw_name = str(row.iloc[0])
        
        if pd.isna(raw_name) or raw_name == 'nan' or raw_name.strip() == '':
            continue

        # 嘗試從姓名提取號碼。
        # 很多時候格式是 "5年 2組 2號 姓名"，我們想要的是最後一個數字（座號）
        nums = re.findall(r'(\d+)', raw_name)
        if nums:
            # 取最後一個數字作為座號
            num = int(nums[-1])
            if num < 100:
                student_id = f"5{num:02d}" # 例如 2號 -> 502
            else:
                student_id = str(num)
        else:
            student_id = str(501 + (i - 2))

        # 移除前綴保留純姓名
        clean_name = raw_name.split(' ')[-1] if ' ' in raw_name else raw_name

        # 尋找弱點 (得分為 0 的節點)
        weak_nodes = []
        for col in node_cols:
            val = row[col]
            try:
                if float(val) == 0:
                    node_code = str(col).split(' ')[0]
                    weak_nodes.append(node_code)
            except:
                pass

        students_data.append({
            "id": student_id,
            "name": clean_name,
            "weak_nodes": list(set(weak_nodes))
        })

    # 去除重複的 ID (避免 PostgreSQL 報錯)
    unique_data = {}
    for s in students_data:
        unique_data[s['id']] = s
    
    final_list = list(unique_data.values())
    print(f"Parsed {len(students_data)} records, unique students: {len(final_list)}.")
    return final_list

def sync_to_supabase(data):
    if not data:
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    print(f"Syncing students to {SUPABASE_URL}...")
    
    # 批次上傳 (建議不要太大，雖然 30 人還好)
    response = requests.post(f"{SUPABASE_URL}/rest/v1/students", headers=headers, json=data)
    
    if response.status_code in [200, 201]:
        print("SUCCESS: Students synced successfully!")
        return True
    else:
        print(f"ERROR: Failed to sync: {response.status_code} - {response.text}")
        return False

if __name__ == "__main__":
    data = process_ods()
    if data:
        sync_to_supabase(data)
