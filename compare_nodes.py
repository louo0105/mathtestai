import os
import json
import re
import pandas as pd

# Paths
EXCEL_PATH = "3-6年級所有數學節點.xlsx"
DATA_JS_PATH = "data.js"
EXTRA_DATA_PATH = "extra_data.js"

def extract_excel_nodes_with_desc(path):
    """從 Excel 提取子節點及其描述"""
    df = pd.read_excel(path)
    
    # Regex for node code: e.g. N-3-1-S01
    node_regex = r'([A-Z]-\d+-\d+-S\d+)'
    
    found_nodes = {}
    for col in df.columns:
        for val in df[col].dropna():
            s_val = str(val)
            match = re.search(node_regex, s_val)
            if match:
                code = match.group(1).upper()
                # 嘗試提取描述
                desc = s_val
                if "：" in s_val:
                    desc = s_val.split("：", 1)[1].strip()
                elif ":" in s_val:
                    desc = s_val.split(":", 1)[1].strip()
                elif " " in s_val:
                    parts = s_val.split(None, 1)
                    if len(parts) > 1:
                        desc = parts[1].strip()
                
                if len(desc) < 2 or desc == code:
                    desc = "未定義描述"
                
                found_nodes[code] = desc
    
    return found_nodes

def get_system_nodes():
    """解析 data.js 和 extra_data.js 獲取系統中的節點和題目數量"""
    if not os.path.exists(DATA_JS_PATH):
        return {}, {}
    
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. 獲取節點描述
    desc_match = re.search(r"const NODES_DESCRIPTIONS = \{(.*?)\};", content, re.DOTALL)
    descriptions = {}
    if desc_match:
        raw_text = desc_match.group(1)
        for line in raw_text.split("\n"):
            line = line.strip()
            if ":" in line:
                parts = line.split(":", 1)
                code = parts[0].strip().strip('"').strip("'")
                descriptions[code.upper()] = parts[1].strip().strip('"').strip("'").rstrip(",")

    # 2. 獲取題庫題目數量
    q_counts = {}
    bank_match = re.search(r"const QUESTION_BANK = (\{.*?\});", content, re.DOTALL)
    if bank_match:
        try:
            bank = json.loads(bank_match.group(1))
            for code, levels in bank.items():
                count = sum(len(qs) for qs in levels.values())
                q_counts[code.upper()] = q_counts.get(code.upper(), 0) + count
        except:
            pass

    if os.path.exists(EXTRA_DATA_PATH):
        try:
            with open(EXTRA_DATA_PATH, "r", encoding="utf-8") as f:
                e_content = f.read()
            e_bank_match = re.search(r"const EXTRA_QUESTION_BANK = (\{.*\});", e_content, re.DOTALL)
            if e_bank_match:
                e_bank = json.loads(e_bank_match.group(1))
                for code, levels in e_bank.items():
                    count = sum(len(qs) for qs in levels.values())
                    q_counts[code.upper()] = q_counts.get(code.upper(), 0) + count
        except:
            pass

    return descriptions, q_counts

def main():
    print("--- 正在讀取 Excel 檔案 ---")
    excel_data = extract_excel_nodes_with_desc(EXCEL_PATH)
    excel_nodes = sorted(list(excel_data.keys()))
    print(f"Excel 中找到的子節點總數: {len(excel_nodes)}")

    print("\n--- 正在讀取系統資料 ---")
    sys_descriptions, sys_q_counts = get_system_nodes()
    
    missing_from_desc = []
    low_count_nodes = []
    
    for node in excel_nodes:
        if node not in sys_descriptions:
            missing_from_desc.append(node)
        
        count = sys_q_counts.get(node, 0)
        if count < 10:
            low_count_nodes.append((node, count))

    print("\n=== 比對結果 ===")
    
    if missing_from_desc:
        print(f"\n[X] System MISSING DEFINITION for nodes ({len(missing_from_desc)} total):")
        for n in missing_from_desc:
            print(f'  "{n}": "{excel_data[n]}",')
    else:
        print("\n[V] All Excel nodes have definitions in the system.")

    if low_count_nodes:
        print(f"\n[!] Nodes with LOW QUESTION COUNT (< 10 questions) ({len(low_count_nodes)} total):")
        for node, count in low_count_nodes:
            desc = sys_descriptions.get(node, "MISSING DESCRIPTION")
            print(f"  - {node}: {count} questions ({desc})")
    else:
        print("\n[V] All nodes have at least 10 questions.")
            
    grades = {}
    for n in excel_nodes:
        m = re.search(r'-(\d)-', n)
        if m:
            g = m.group(1)
            grades[g] = grades.get(g, 0) + 1
    
    print("\n--- Excel Node Distribution by Grade ---")
    for g in sorted(grades.keys()):
        print(f"  Grade {g}: {grades[g]} nodes")

if __name__ == "__main__":
    main()
