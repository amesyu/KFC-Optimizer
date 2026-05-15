import json
import pulp
import os
from collections import defaultdict
from itertools import chain

def solve_menu_optimization(menu_data, target_items, exact_match=False):
    if len(menu_data) > 0 and isinstance(menu_data[0], list):
        # [[...], [...]] -> [...]
        menus = list(chain.from_iterable(menu_data))
    else:
        menus = menu_data

    item_counts = defaultdict(int)
    for menu in menus:
        for item_name, count in menu["items"].items():
            item_counts[item_name] += 0
    for item_name in target_items.keys():
        item_counts[item_name] += 0

    item_list = sorted(item_counts.keys())
    item_to_idx = {name: i for i, name in enumerate(item_list)}
    num_dims = len(item_list)

    target_vector = [0] * num_dims
    for name, count in target_items.items():
        target_vector[item_to_idx[name]] = count

    prob = pulp.LpProblem("Menu_Optimization", pulp.LpMinimize)
    
    choices = []
    for i, menu in enumerate(menus):
        up_bound = menu["limit"] if menu.get("limit", -1) != -1 else None
        var = pulp.LpVariable(f"menu_{i}", lowBound=0, upBound=up_bound, cat=pulp.LpInteger)
        choices.append(var)
    
    # 目的関数
    prob += pulp.lpSum([menus[i]["price"] * choices[i] for i in range(len(menus))])
    for d_idx, item_name in enumerate(item_list):
        item_sum = [menus[i]["items"].get(item_name, 0) * choices[i] for i in range(len(menus))]
        if exact_match:
            prob += pulp.lpSum(item_sum) == target_vector[d_idx]
        else:
            prob += pulp.lpSum(item_sum) >= target_vector[d_idx]
        
    # 投げる
    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))
    
    if pulp.LpStatus[status] == 'Optimal':
        selected = []
        for i, menu in enumerate(menus):
            val = pulp.value(choices[i])
            if val and val > 0:
                selected.append({
                    "name": menu["name"],
                    "count": int(val),
                    "price": menu["price"],
                    "items": menu["items"]
                })
        return {"status": "Optimal", "total_price": int(pulp.value(prob.objective)), "selection": selected}
    else:
        return {"status": pulp.LpStatus[status]}

file_path = '../menu_generator/menu_lunch.json'
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # 目標
    target = {"オリジナルチキン": 7, "ポテトS": 2, "ビスケット": 2}

    result = solve_menu_optimization(raw_data, target, False)
    
    if result["status"] == "Optimal":
        print(f"合計金額: {result['total_price']}円")
        for s in result["selection"]:
            print(f"* {s['name']} x {s['count']} ({s['price']}円/個)")
            for item_name, qty in s["items"].items():
                total_qty = qty * s["count"]
                print(f"    + {item_name}: {qty}個 (計 {total_qty}個)")
    else:
        print(f"解が見つかりませんでした: {result['status']}")
else:
    print(f"ファイルが見つかりません: {file_path}")