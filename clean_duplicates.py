import json
import re
import time

def clean_duplicates():
    extra_path = 'extra_data.js'
    if not os.path.exists(extra_path):
        print("找不到 extra_data.js")
        return

    with open(extra_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'const EXTRA_QUESTION_BANK = (\{.*\});', content, re.DOTALL)
    if not match:
        print("無法解析 EXTRA_QUESTION_BANK")
        return

    bank = json.loads(match.group(1))
    removed_total = 0

    for node_id, difficulties in bank.items():
        for level in ['beginner', 'intermediate', 'advanced']:
            if level in difficulties:
                original = difficulties[level]
                unique_list = []
                seen_q = set()
                
                for item in original:
                    q_text = item['q'].strip()
                    if q_text not in seen_q:
                        unique_list.append(item)
                        seen_q.add(q_text)
                    else:
                        removed_total += 1
                
                difficulties[level] = unique_list

    # 寫回檔案
    update_time = time.ctime()
    with open(extra_path, 'w', encoding='utf-8') as f:
        f.write(f"// 題庫去重與淨化 - 執行時間: {update_time}\n")
        f.write(f"const EXTRA_DATA_UPDATE_TIME = '{update_time}';\n")
        f.write("const EXTRA_QUESTION_BANK = ")
        json.dump(bank, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"去重完成！共移除了 {removed_total} 個重複題目。")

if __name__ == "__main__":
    import os
    clean_duplicates()
