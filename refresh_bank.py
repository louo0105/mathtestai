import os
import json
import time
import re
import requests
import sys

# ==========================================
# 配置區
# ==========================================
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "") 
MODEL = "llama-3.3-70b-versatile"
DATA_JS_PATH = "data.js"
EXTRA_DATA_PATH = "extra_data.js"
CHECKPOINT_PATH = "refresh_checkpoint.json"

# ==========================================
# 核心功能
# ==========================================

def get_node_descriptions():
    """解析 data.js 提取知識點清單"""
    if not os.path.exists(DATA_JS_PATH):
        print(f"[Error] Cannot find {DATA_JS_PATH}")
        return {}
    
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    match = re.search(r"const NODES_DESCRIPTIONS = \{(.*?)\};", content, re.DOTALL)
    if not match:
        print("[Error] Cannot parse NODES_DESCRIPTIONS")
        return {}
    
    raw_text = match.group(1)
    nodes = {}
    for line in raw_text.split("\n"):
        line = line.strip()
        if ":" in line:
            parts = line.split(":", 1)
            code = parts[0].strip().strip('"').strip("'")
            desc = parts[1].strip().strip('"').strip("'").rstrip(",")
            nodes[code] = desc
    return nodes

def load_existing_extra_bank():
    """試著從現有的 extra_data.js 讀取已有的題目"""
    if not os.path.exists(EXTRA_DATA_PATH):
        return {}
    try:
        with open(EXTRA_DATA_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r"const EXTRA_QUESTION_BANK = (\{.*\});", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    except Exception as e:
        print(f"[Warning] Failed to read extra bank: {e}")
    return {}

def generate_questions(node_code, description):
    """呼叫 Groq API 生成題目"""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""你是一位專業數學老師，請針對知識點 [{node_code}: {description}] 生成 5 題混合難度的數學練習題。
請嚴格以 JSON 格式回傳，格式必須為：
{{
  "questions": [
    {{
      "q": "題目內容...",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "correct": 0,
      "exp": "詳細解析內容..."
    }}
  ]
}}
其中 correct 為 0-3。不要回傳任何 Markdown 或輔助文字，僅回傳 JSON。"""

    try:
        response = requests.post(url, headers=headers, json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "response_format": {"type": "json_object"}
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            text = data['choices'][0]['message']['content']
            parsed = json.loads(text)
            return parsed.get("questions", [])
        else:
            print(f"[Warning] API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"[Error] Request failed: {e}")
        return None

def main():
    global GROQ_API_KEY
    print("\n" + "="*40)
    print("[AI Bank Tool] Maintenance")
    print("="*40)
    
    if not GROQ_API_KEY:
        GROQ_API_KEY = input("Enter your GROQ_API_KEY: ").strip()
        if not GROQ_API_KEY:
            print("[Error] API KEY required.")
            return

    # 檢查參數控制
    is_patch_mode = "--patch" in sys.argv
    target_grade = None
    for arg in sys.argv:
        if arg.startswith("--grade"):
            try:
                # 支援 --grade 5 或 --grade=5
                idx = sys.argv.index(arg)
                if "=" in arg:
                    target_grade = arg.split("=")[1]
                else:
                    target_grade = sys.argv[idx+1]
            except:
                pass

    if not is_patch_mode and not target_grade:
        print("\nMode Selection:")
        print("[1] Full Refresh (Clear and rebuild)")
        print("[2] Patch Mode (Fill missing questions)")
        choice = input("\nSelect Mode (Default 2): ").strip()
        if choice == "1":
            is_patch_mode = False
        else:
            is_patch_mode = True

    nodes = get_node_descriptions()
    new_bank = {}

    if is_patch_mode:
        print("\n[Mode] Patching Missing Questions...")
        new_bank = load_existing_extra_bank()
        print(f"[Info] Loaded {len(new_bank)} existing nodes.")
    else:
        print("\n[Mode] Full Refresh...")

    # 根據年級過濾
    all_codes = sorted(list(nodes.keys()))
    if target_grade:
        print(f"[Target] Grade: {target_grade}")
        all_codes = [c for c in all_codes if f"-{target_grade}-" in c]

    # 檢查是否也要載入中斷的進度 (Checkpoint)
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
            cp_data = json.load(f)
            # 只有在符合目標年級的情況下才合併暫存位元組
            if target_grade:
                cp_data = {k:v for k,v in cp_data.items() if f"-{target_grade}-" in k}
            new_bank.update(cp_data)
        print(f"[Checkpoint] Merged {len(cp_data)} temporary nodes.")

    nodes_to_process = [c for c in all_codes if c not in new_bank or not new_bank[c].get('beginner')]
    
    if not nodes_to_process:
        print(f"[OK] Grade ({target_grade if target_grade else 'All'}) is already complete!")
        return

    print(f"[Stats] {len(nodes_to_process)} nodes to process.")
    
    try:
        for i, code in enumerate(nodes_to_process):
            print(f"[Processing] [{i+1}/{len(nodes_to_process)}] Generating {code}...")
            qs = generate_questions(code, nodes[code])
            
            if qs:
                new_bank[code] = {
                    "beginner": qs[:2],
                    "intermediate": qs[2:4],
                    "advanced": qs[4:]
                }
                # 存檔點
                with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
                    to_save = {k:v for k,v in new_bank.items() if k in nodes_to_process}
                    json.dump(to_save, f, ensure_ascii=False)
                
                time.sleep(3) 
            else:
                print(f"[Error] {code} failed, skipping.")
                time.sleep(1)

    except KeyboardInterrupt:
        print("\n[Stop] Interrupted by user.")
    
    # 寫出最終檔案
    final_full_bank = load_existing_extra_bank()
    final_full_bank.update(new_bank)

    update_time = time.ctime()
    print("\n[Packaging] Bundling final JS file...")
    with open(EXTRA_DATA_PATH, "w", encoding="utf-8") as f:
        f.write(f"// 自動更新題庫 - 最後更新: {update_time}\n")
        f.write(f"const EXTRA_DATA_UPDATE_TIME = '{update_time}';\n")
        f.write("const EXTRA_QUESTION_BANK = ")
        json.dump(final_full_bank, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    print(f"[Finish] Completed! Saved to {EXTRA_DATA_PATH}")
    
    if os.path.exists(CHECKPOINT_PATH):
        os.remove(CHECKPOINT_PATH)

if __name__ == "__main__":
    main()

