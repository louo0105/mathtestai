import pandas as pd
import requests
import json
import re

# 配置
SUPABASE_URL = 'https://qvepxxnikggexobibsvw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZXB4eG5pa2dnZXhvYmlic3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzk1OTQsImV4cCI6MjA5MTYxNTU5NH0.XZ44sLqdgtQ9UMx2mNZfI-SyxwRVXQFNr90kpGdrFWE'
import glob
import os

ODS_FILE_DEFAULT = '學力檢測考古題 113年學力檢測-5年級數學 25題_任務匯出.ods'

def find_latest_ods():
    """尋找資料夾中最新的 ODS 檔案"""
    if os.path.exists(ODS_FILE_DEFAULT):
        return ODS_FILE_DEFAULT
    
    ods_files = glob.glob("*.ods")
    if not ods_files:
        return None
    
    # 依修改時間排序，取最新的
    ods_files.sort(key=os.path.getmtime, reverse=True)
    return ods_files[0]

def process_ods():
    ods_path = find_latest_ods()
    if not ods_path:
        print("[Error] No .ods files found in current directory.")
        return None

    print(f"Reading ODS file: {ods_path}...")
    try:
        df = pd.read_excel(ods_path, engine='odf')
    except Exception as e:
        print(f"Error reading ODS: {e}")
        return None

    # 找出知識點欄位 (格式如 N-5-6-S04)
    # 支援 A-B-C 或 A-B-C-D 格式
    node_cols = [c for c in df.columns if re.match(r'[A-Z]-\d+-\d+(-\w+)?', str(c))]
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
                    node_code = re.match(r'([A-Z]-\d+-\d+(-\w+)?)', str(col)).group(1)
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
    return final_list, node_cols

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

def check_node_coverage(ods_nodes):
    # 載入全部知識點定義
    all_descriptions = get_node_descriptions()
    # 載入現有題庫 (合併原始與擴充)
    existing_extra = load_existing_extra_bank()
    
    # 這裡我們需要讀取原始 data.js 中的 QUESTION_BANK 來做完整比對
    # 為了效能，我們直接檢查 ods_nodes
    missing_nodes = []
    for node in ods_nodes:
        # 檢查是否在 extra 中
        has_extra = node in existing_extra and len(existing_extra[node].get('beginner', [])) > 0
        # 如果 extra 沒有，也要檢查 master bank (這部分邏輯通常在 refresh_bank 或 data.js)
        # 為了保險，只要 extra 沒有且 user 覺得有問題，我們就列入檢查
        if not has_extra:
            missing_nodes.append(node)

def run_ods_sync():
    data, node_cols = process_ods()
    if data:
        success = sync_to_supabase(data)
        # 收集 ODS 標題中所有的知識點 (而不只是弱點)
        all_possible_nodes = []
        for col in node_cols:
            m = re.match(r'([A-Z]-\d+-\d+(-\w+)?)', str(col))
            if m:
                all_possible_nodes.append(m.group(1))

        return data, list(set(all_possible_nodes))
    return None, []

if __name__ == "__main__":
    run_ods_sync()
