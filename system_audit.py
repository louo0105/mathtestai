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

def is_placeholder(qs):
    """判斷題目是否為空殼或低品質"""
    if not qs: return True
    real_qs = []
    seen_questions = set()
    for q in qs:
        q_text = q.get('q', "").strip()
        options = q.get('options', [])
        exp = q.get('exp', "")
        
        # 排除重複
        if q_text in seen_questions: continue
        seen_questions.add(q_text)
        
        # 排除字數過短 (通常是假題)
        if len(q_text) < 10: continue
            
        # 排除包含假題關鍵字的題目
        has_fake = any(k in str(options) + exp for k in ["錯誤值", "正確結果", "基礎題型", "此為正確的觀念描述", "該觀念的錯誤誤解"])
        
        if not has_fake:
            real_qs.append(q)
    
    # 有效題目少於 2 題則視為空殼節點
    return len(real_qs) < 2

def run_audit():
    print("--- 正在進行全系統題庫健檢 ---")
    
    # 載入所有節點定義
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    desc_match = re.search(r"const NODES_DESCRIPTIONS = \{(.*?)\};", content, re.DOTALL)
    all_nodes = []
    if desc_match:
        for line in desc_match.group(1).split("\n"):
            m = re.search(r'["\'](.*?)["\']\s*:', line)
            if m: all_nodes.append(m.group(1))
            
    # 載入題庫
    master_bank = load_js_object(DATA_JS_PATH, "QUESTION_BANK")
    extra_bank = load_js_object(EXTRA_DATA_PATH, "EXTRA_QUESTION_BANK")
    
    results = {
        "missing": [],     # 完全沒題目
        "placeholder": [], # 有題目但都是空殼
        "low_count": []    # 真題數量不足 (少於 10 題)
    }
    
    for node in all_nodes:
        qs_m = master_bank.get(node, {}).get("beginner", []) + master_bank.get(node, {}).get("intermediate", []) + master_bank.get(node, {}).get("advanced", [])
        qs_e = extra_bank.get(node, {}).get("beginner", []) + extra_bank.get(node, {}).get("intermediate", []) + extra_bank.get(node, {}).get("advanced", [])
        all_qs = qs_m + qs_e
        
        if not all_qs:
            results["missing"].append(node)
        elif is_placeholder(all_qs):
            results["placeholder"].append(node)
        elif len(all_qs) < 10:
            results["low_count"].append((node, len(all_qs)))
            
    return results

if __name__ == "__main__":
    audit_results = run_audit()
    print(f"\n[結果統計]")
    print(f"- 缺失節點 (0題): {len(audit_results['missing'])}")
    print(f"- 空殼節點 (假題): {len(audit_results['placeholder'])}")
    print(f"- 題數不足 (<10題): {len(audit_results['low_count'])}")
    
    print("\n[待處理清單 - 缺失/空殼]")
    combined = audit_results['missing'] + audit_results['placeholder']
    for node in combined:
        print(f"  - {node}")
