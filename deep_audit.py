import json
import os
import re

# Paths
DATA_JS_PATH = "data.js"
EXTRA_DATA_PATH = "extra_data.js"

def load_js_object(path, var_name):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(f"const {var_name} = (\{{.*\}});", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except:
            return {}
    return {}

def run_deep_audit():
    print("--- 正在檢查各等級題數 (目標: 初/中/高 各 5 題) ---")
    
    # 載入所有節點
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    desc_match = re.search(r"const NODES_DESCRIPTIONS = \{(.*?)\};", content, re.DOTALL)
    all_nodes = []
    if desc_match:
        for line in desc_match.group(1).split("\n"):
            m = re.search(r'["\'](.*?)["\']\s*:', line)
            if m: all_nodes.append(m.group(1))
            
    master_bank = load_js_object(DATA_JS_PATH, "QUESTION_BANK")
    extra_bank = load_js_object(EXTRA_DATA_PATH, "EXTRA_QUESTION_BANK")
    
    low_counts = []
    
    for node in all_nodes:
        qs_m = master_bank.get(node, {})
        qs_e = extra_bank.get(node, {})
        
        b = len(qs_m.get("beginner", [])) + len(qs_e.get("beginner", []))
        i = len(qs_m.get("intermediate", [])) + len(qs_e.get("intermediate", []))
        a = len(qs_m.get("advanced", [])) + len(qs_e.get("advanced", []))
        
        if b < 5 or i < 5 or a < 5:
            low_counts.append((node, b, i, a))
            
    return low_counts

if __name__ == "__main__":
    results = run_deep_audit()
    print(f"\n[待補強節點] 總計: {len(results)} 個")
    for node, b, i, a in results:
        print(f"  - {node}: (初:{b}, 中:{i}, 高:{a})")
