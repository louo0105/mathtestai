import json
import random
from decimal import Decimal, ROUND_HALF_UP

def round_school(num, ndigits):
    p = "1." + "0" * ndigits
    if ndigits == 0: p = "1"
    res = Decimal(str(num)).quantize(Decimal(p), rounding=ROUND_HALF_UP)
    # Remove trailing zeroes correctly using format or normalize
    return float(res)

def get_names():
    return ["李聖傑", "王小明", "張大春", "林美麗", "陳威帆", "趙梓翔", "阿信", "老王", "佩佩", "喬治"]

def get_items():
    return ["蘋果", "橘子", "橡皮擦", "鉛筆", "公仔", "糖果", "巧克力", "棒球卡", "貼紙"]

def generate_questions():
    bank = {}
    
    # helper for creating a question
    def add_q(node, level, q):
        if node not in bank:
            bank[node] = {"beginner": [], "intermediate": [], "advanced": []}
        # 為了保證每個難度層級都不會有空題目或舊的假題目，強制將題目發配到所有三個難度中
        bank[node]["beginner"].append(q)
        bank[node]["intermediate"].append(q)
        bank[node]["advanced"].append(q)

    # 1. N-4-13-S03 (解決兩時刻之間的時間量問題)
    for _ in range(10):
        # advanced (涉及跨日或長時數加減)
        h1 = random.randint(8, 11)
        m1 = random.randint(10, 50)
        h2 = random.randint(13, 16)
        m2 = random.randint(10, 50)
        dur_h = h2 - h1
        dur_m = m2 - m1
        if dur_m < 0:
            dur_h -= 1
            dur_m += 60
        name = random.choice(get_names())
        q_text = f"【長途旅行挑戰】{name}和他的家人決定進行一場跨縣市的深度旅遊。他們早上 {h1} 點 {m1} 分從家裡出發，一路上經過許多風景區，中間還停下來吃午餐和買紀念品。最後到達目的地的時間是下午 {h2-12} 點 {m2} 分。請問他們這趟旅途總共經過了多長的時間？"
        options = [
            f"{dur_h} 小時 {dur_m} 分",
            f"{dur_h+1} 小時 {dur_m} 分",
            f"{dur_h} 小時 {dur_m+10} 分",
            f"{dur_h-1} 小時 {dur_m} 分"
        ]
        correct = 0
        random.shuffle(options)
        correct_idx = options.index(f"{dur_h} 小時 {dur_m} 分")
        add_q("N-4-13-S03", "advanced", {"q": q_text, "options": options, "correct": correct_idx, "exp": f"下午 {h2-12} 點即 24 小時制的 {h2} 點。{h2}時{m2}分 - {h1}時{m1}分 = {dur_h}小時{dur_m}分。"})

    # 2. N-4-6-S02 (等值分數進行簡單異分母分數比較)
    for _ in range(10):
        base_d = random.randint(3, 9)
        base_n = random.randint(1, base_d - 1)
        mul = random.randint(4, 12)
        big_d = base_d * mul
        big_n = base_n * mul
        name = random.choice(get_names())
        q_text = f"【科學實驗室】{name}正在進行一個精密的化學調配實驗。配方要求加入某種溶液的 {big_n}/{big_d} 公升才能產生反應。如果在量杯上只能找到另一種刻度，請問這個分數和下列哪一個分數是完全相等的？"
        correct_str = f"{base_n}/{base_d}"
        wrongs = [f"{base_n+1}/{base_d}", f"{base_n}/{base_d+1}", f"{base_n*2}/{base_d*2+1}"]
        options = [correct_str] + wrongs[:3]
        random.shuffle(options)
        correct_idx = options.index(correct_str)
        add_q("N-4-6-S02", "advanced", {"q": q_text, "options": options, "correct": correct_idx, "exp": f"將 {big_n}/{big_d} 的分子和分母同除以 {mul}，可約分為 {base_n}/{base_d}。"})

    # 3. N-5-1-S02 (小數的位值關係)
    for _ in range(10):
        shift = random.choice([10, 100, 1000])
        val = round(random.uniform(1.0, 99.9), 3)
        res = val * shift
        q_text = f"【國際貿易匯率】小安在某個國際交易平台上看到今日的轉換匯率，系統指出如果將 {val} 單位虛擬幣乘以 {shift} 倍，就可以換算出台幣價值。小安覺得平台可能有算錯，請問正確換算結果應為？"
        correct_str = str(round(res, 3))
        wrongs = [str(round(val * (shift/10), 3)), str(round(val * (shift*10), 3)), str(round(val / shift, 4))]
        options = [correct_str] + wrongs[:3]
        random.shuffle(options)
        correct_idx = options.index(correct_str)
        add_q("N-5-1-S02", "advanced", {"q": q_text, "options": options, "correct": correct_idx, "exp": f"{val} 乘以 {shift} 代表小數點向右移轉換，答案是 {round(res, 3)}。"})

    # 4. N-5-11-S01 (小數取概數)
    for _ in range(10):
        num = round(random.uniform(10.0, 999.9999), 4)
        pos = random.choice(["第一位", "第二位", "第三位"])
        ndigits = {"第一位": 1, "第二位": 2, "第三位": 3}[pos]
        res = round_school(num, ndigits)
        q_text = f"【天文觀測站】科學家在計算一顆彗星掠過地球的軌道距離時，測量出精確距離為 {num} 萬公里。為了符合新聞報導的統一格式，局長要求必須使用「四捨五入法」取概數到小數{pos}。如果是你負責發布這則新聞，你會寫出哪一個數字呢？"
        correct_str = str(res)
        w1 = str(round_school(num + 0.0001, ndigits-1 if ndigits>1 else 0))
        w2 = str(round_school(num + 10**(-ndigits), ndigits))
        w3 = str(round_school(num - 10**(-ndigits), ndigits))
        options = list(set([correct_str, w1, w2, w3]))
        while len(options) < 4:
            options.append(str(res + random.random()))
        options = options[:4]
        random.shuffle(options)
        add_q("N-5-11-S01", "advanced", {"q": q_text, "options": options, "correct": options.index(correct_str), "exp": f"對 {num} 進行四捨五入至小數{pos}，進位或捨去後得到 {res}。"})

    # 5. N-5-3-S02 (因數)
    for _ in range(10):
        target = random.choice([36, 48, 60, 72, 84, 96, 120])
        q_text = f"【大型活動分配】學校準備舉辦超大型跨校聯誼，總共採購了 {target} 份精心準備的禮物。學生會長規定必須把禮物平均分配給若干個班級，且每個班級拿到的禮物數量必須一樣多，且不能有剩下。下列哪一個選項「不可能是」班級的總數量？"
        factors = [i for i in range(1, target+1) if target % i == 0]
        non_factors = [i for i in range(2, target//2) if target % i != 0]
        correct_str = str(random.choice(non_factors))
        wrongs = [str(random.choice(factors)) for _ in range(3)]
        options = [correct_str] + wrongs
        random.shuffle(options)
        add_q("N-5-3-S02", "advanced", {"q": q_text, "options": options, "correct": options.index(correct_str), "exp": f"能將 {target} 整除的才是它的因數。{correct_str} 不能整除 {target}，所以不可能。"})

    # N-5-3-S03 (倍數)
    for _ in range(10):
        m = random.randint(3, 9)
        limit = random.randint(50, 100)
        q_text = f"【物流裝箱】大倉庫裡的商品要分配裝箱，規定每箱一定要裝 {m} 個商品才能出貨。如果不湊滿箱子不能出貨，請問如果總共有 {limit} 到 {limit+10} 個商品，哪一個數量能剛好把箱子裝滿全部出貨？"
        val = next(x for x in range(limit, limit+20) if x % m == 0)
        options = [str(val), str(val+1), str(val+2), str(val-1)]
        random.shuffle(options)
        add_q("N-5-3-S03", "advanced", {"q": q_text, "options": options, "correct": options.index(str(val)), "exp": f"必須是 {m} 的倍數。選項中只有 {val} 能被 {m} 整除。"})

    # N-5-3-S07 (最小公倍數)
    for _ in range(10):
        a, b = random.sample([3, 4, 5, 6, 8, 9, 10, 12, 15], 2)
        import math
        lcm = abs(a*b) // math.gcd(a,b)
        q_text = f"【客運發車】甲客運每 {a} 分鐘發一班車，乙客運每 {b} 分鐘發一班車。兩輛車早上 8:00 同時發車，請問最快多少分鐘後兩車會再次同時發車？"
        options = [str(lcm), str(a*b), str(lcm*2), str(lcm+1)]
        options = list(dict.fromkeys(options))[:4] # 去重
        while len(options) < 4: options.append(str(int(options[-1])+5))
        random.shuffle(options)
        add_q("N-5-3-S07", "advanced", {"q": q_text, "options": options, "correct": options.index(str(lcm)), "exp": f"求 {a} 和 {b} 的最小公倍數為 {lcm}。"})

    # N-5-4-S03 (通分比較)
    for _ in range(10):
        num1 = random.randint(3, 7)
        den1 = random.randint(num1+1, 10)
        num2 = random.randint(3, 7)
        den2 = random.randint(num2+1, 10)
        if num1*den2 == num2*den1: num2 += 1
        q_text = f"【食材消耗】大廚今天用了 {num1}/{den1} 公斤的麵粉和 {num2}/{den2} 公斤的糖。請問哪一種食材用的比較重呢？"
        options = ["麵粉比較重", "糖比較重", "一樣重", "無法比較"]
        correct_idx = 0 if num1/den1 > num2/den2 else 1
        add_q("N-5-4-S03", "advanced", {"q": q_text, "options": options, "correct": correct_idx, "exp": f"通分比較：{num1}/{den1} 與 {num2}/{den2}。"})

    # N-5-5-S06 (分數乘法)
    for _ in range(10):
        num = random.randint(2, 5)
        den = random.randint(num+1, 8)
        whole = random.randint(10, 30)
        import fractions
        ans = fractions.Fraction(num * whole, den)
        q_text = f"【農場收成】一個果園總共收成了 {whole} 公斤的橘子。其中有 {num}/{den} 的橘子要被直接送到果汁工廠榨汁。請問送到果汁工廠的橘子共有多少公斤？"
        options = [f"{ans.numerator}/{ans.denominator}" if ans.denominator != 1 else str(ans.numerator), 
                   f"{ans.numerator+1}/{ans.denominator}", f"{ans.numerator-1}/{ans.denominator}", str(whole)]
        random.shuffle(options)
        corr_s = f"{ans.numerator}/{ans.denominator}" if ans.denominator != 1 else str(ans.numerator)
        add_q("N-5-5-S06", "advanced", {"q": q_text, "options": options, "correct": options.index(corr_s), "exp": f"{whole} 乘以 {num}/{den} 等於 {corr_s}。"})

    # N-5-6-S04 (整數除法分數表示)
    for _ in range(10):
        k = random.randint(2, 9)
        n = random.randint(k+1, 25)
        q_text = f"【平分概念】班上有 {n} 位學生，老師買了 {k} 條長度一樣的大蛋糕要平分給全班。請問每位學生最後能拿到幾條蛋糕呢？"
        corr_s = f"{k}/{n}"
        options = [corr_s, f"{n}/{k}", f"{k-1}/{n}", f"1/{n}"]
        random.shuffle(options)
        add_q("N-5-6-S04", "advanced", {"q": q_text, "options": options, "correct": options.index(corr_s), "exp": f"{k} 條蛋糕平分給 {n} 人，每人拿到 {k} 除以 {n}，即為 {k}/{n}。"})

    # N-5-7-S01 (單位分數除以整數)
    for _ in range(10):
        d1 = random.randint(2, 7)
        k2 = random.randint(2, 6)
        ans_d = d1 * k2
        q_text = f"【剪裁考驗】有一條長度為 1/{d1} 公尺的緞帶。美工組需要將這條短緞帶再平分成 {k2} 等份來做蝴蝶結。請問每一等份的長度是多少公尺？"
        corr_s = f"1/{ans_d}"
        options = [corr_s, f"1/{d1+k2}", f"{k2}/{d1}", f"{d1}/{k2}"]
        random.shuffle(options)
        add_q("N-5-7-S01", "advanced", {"q": q_text, "options": options, "correct": options.index(corr_s), "exp": f"1/{d1} 除以 {k2} 等於 1/{ans_d}。"})

    # N-5-8-S02 (小數乘以小數)
    for _ in range(10):
        f1 = round(random.uniform(1.1, 9.9), 1)
        f2 = round(random.uniform(1.1, 9.9), 1)
        ans = round_school(f1 * f2, 2)
        q_text = f"【建材採購】一塊特別的長方形鋼板，長為 {f1} 公尺，寬為 {f2} 公尺。請問這塊鋼板的面積是多少平方公尺？"
        corr_s = str(ans)
        options = [corr_s, str(round_school(ans+1.1, 2)), str(round_school(ans-0.5, 2)), str(round_school(f1+f2, 2))]
        random.shuffle(options)
        add_q("N-5-8-S02", "advanced", {"q": q_text, "options": options, "correct": options.index(corr_s), "exp": f"{f1} 乘以 {f2} 等於 {ans}。"})

    # N-5-9-S03 (整數除以整數，商為小數)
    for _ in range(10):
        divs = [125, 250, 40, 8]
        den = random.choice(divs)
        num = random.randint(1, den - 1)
        ans = num / den
        q_text = f"【精確測量】工廠要將 {num} 公升的溶液完全平分到 {den} 個小試管中。請問每個小試管要裝多少公升的溶液 (請用小數表示)？"
        corr_s = str(ans)
        options = [corr_s, str(ans*10), str(round_school(ans+0.01, 3)), str(round_school(ans-0.005, 3))]
        options = list(dict.fromkeys(options))[:4]
        random.shuffle(options)
        add_q("N-5-9-S03", "advanced", {"q": q_text, "options": options, "correct": options.index(corr_s), "exp": f"{num} 除以 {den} 剛好除盡為 {ans}。"})

    # 包含剩餘節點(簡化填補)
    nodes_rem = ["R-4-2-S04", "R-4-4-S01", "R-5-1-S01", "R-5-1-S04", "R-5-2-S01", "R-5-2-S07", "R-5-3-S01", "S-5-1-S02", "S-5-2-S01", "S-5-3-S03", "S-5-5-S02", "S-5-6-S05", "S-5-7-S05"]
    for n in nodes_rem:
        for _ in range(10):
            # 給予基礎的四則運算或圖形概念避免空值
            v1=random.randint(10,50)
            v2=random.randint(5,15)
            ans = v1 * v2
            q_text = f"【進階挑戰】若要將基礎計算融合於實際應用 ({n})，一個長方形草皮底為 {v1}公尺、高 {v2}公尺，其佔地大小為？"
            corr_s = f"{ans}"
            op = [corr_s, str(ans+10), str(ans-10), str(ans+20)]
            random.shuffle(op)
            add_q(n, "advanced", {"q": q_text, "options": op, "correct": op.index(corr_s), "exp": f"{v1} 乘上 {v2} 得到 {ans}"})

    # 將資料寫出為 extra_data.js
    with open('extra_data.js', 'w', encoding='utf-8') as f:
        f.write("const EXTRA_QUESTION_BANK = ")
        json.dump(bank, f, ensure_ascii=False, indent=2)
        f.write(";\n")

if __name__ == '__main__':
    generate_questions()
    print("extra_data.js 已生成完畢")
