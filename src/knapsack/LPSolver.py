import json
import pulp
import os
from collections import defaultdict
from itertools import chain


def flatten_menus(menu_data):
    """Flatten nested menu lists into a single list."""
    if len(menu_data) > 0 and isinstance(menu_data[0], list):
        return list(chain.from_iterable(menu_data))
    return menu_data


def build_item_list(menus, target_items):
    """Build sorted item list and create mapping to indices."""
    item_counts = defaultdict(int)
    for menu in menus:
        for item_name in menu.get("items", {}).keys():
            item_counts[item_name] += 0
    for item_name in target_items.keys():
        item_counts[item_name] += 0
    
    item_list = sorted(item_counts.keys())
    item_to_idx = {name: i for i, name in enumerate(item_list)}
    return item_list, item_to_idx


def build_target_vector(target_items, item_to_idx):
    """Convert target items dict to vector aligned with item list."""
    target_vector = [0] * len(item_to_idx)
    for name, count in target_items.items():
        if name in item_to_idx:
            target_vector[item_to_idx[name]] = count
    return target_vector


def create_lp_variables(menus):
    """Create LP variables for each menu with proper bounds."""
    choices = []
    for i, menu in enumerate(menus):
        up_bound = menu.get("limit", -1) if menu.get("limit", -1) != -1 else None
        var = pulp.LpVariable(f"menu_{i}", lowBound=0, upBound=up_bound, cat=pulp.LpInteger)
        choices.append(var)
    return choices


def add_objective_function(prob, menus, choices):
    """Add cost minimization objective to LP problem."""
    prob += pulp.lpSum([menus[i]["price"] * choices[i] for i in range(len(menus))])


def add_constraints(prob, menus, choices, item_list, target_vector, exact_match=False):
    """Add item quantity constraints to LP problem."""
    for d_idx, item_name in enumerate(item_list):
        item_sum = [menus[i].get("items", {}).get(item_name, 0) * choices[i] 
                    for i in range(len(menus))]
        if exact_match:
            prob += pulp.lpSum(item_sum) == target_vector[d_idx]
        else:
            prob += pulp.lpSum(item_sum) >= target_vector[d_idx]


def solve_menu_optimization(menu_data, target_items, exact=False):
    """Solve menu optimization problem using LP."""
    menus = flatten_menus(menu_data)
    item_list, item_to_idx = build_item_list(menus, target_items)
    target_vector = build_target_vector(target_items, item_to_idx)
    
    prob = pulp.LpProblem("Menu_Optimization", pulp.LpMinimize)
    choices = create_lp_variables(menus)
    
    add_objective_function(prob, menus, choices)
    add_constraints(prob, menus, choices, item_list, target_vector, exact)
    
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

def load_menu_json(file_path):
    """Load menu data from JSON file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_problem_config_from_json(file_path):
    """Load exact/lunch flags and target items from JSON file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle array format: [{ "items": {...} }]
    if isinstance(data, list) and len(data) > 0:
        obj = data[0]
    elif isinstance(data, dict):
        obj = data
    else:
        raise ValueError("Invalid target JSON format")
    
    if "items" not in obj or not isinstance(obj["items"], dict):
        raise ValueError("Target JSON must contain 'items' object")
    
    return {
        "exact": bool(obj.get("exact", False)),
        "lunch": bool(obj.get("lunch", False)),
        "items": obj["items"],
    }


def format_and_print_result(result):
    """Format and print optimization result."""
    if result["status"] == "Optimal":
        print(f"合計金額: {result['total_price']}円")
        for s in result["selection"]:
            print(f"* {s['name']} x {s['count']} ({s['price']}円/個)")
            for item_name, qty in s["items"].items():
                total_qty = qty * s["count"]
                print(f"    + {item_name}: {qty}個 (計 {total_qty}個)")
    else:
        print(f"解が見つかりませんでした: {result['status']}")


def main():
    """Main entry point."""
    menu_normal_file = '../menu_generator/menu_normal.json'
    menu_lunch_file = '../menu_generator/menu_lunch.json'
    target_file = '../menu_generator/ask_sample.json_sample'
    try:
        config = load_problem_config_from_json(target_file)
        menu_file = menu_lunch_file if config["lunch"] else menu_normal_file
        raw_data = load_menu_json(menu_file)
        result = solve_menu_optimization(raw_data, config["items"], config["exact"])
        format_and_print_result(result)
    except (FileNotFoundError, ValueError) as e:
        print(f"エラー: {e}")


if __name__ == "__main__":
    main()