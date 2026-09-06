"""Reference solver for comparing browser results with PuLP."""

from __future__ import annotations

import json
from itertools import combinations_with_replacement
from pathlib import Path

import pulp

MAX_INPUT_COUNT = 100
MAX_TARGET_QUANTITY = 1000
POTATO_QUANTITIES = {"ポテトS": 80, "ポテトL": 160, "BOXポテト": 400}
POTATO_VECTOR = "ポテト(g)"


def menu_path(menu: dict) -> list[str]:
    return menu.get("path") or [menu.get("category", "その他")]


def is_menu_enabled(catalog: dict, menu: dict) -> bool:
    if menu.get("disabled", False):
        return False
    disabled_folders = {
        tuple(folder["path"]): folder.get("disabled", False)
        for folder in catalog.get("folders", [])
    }
    path = menu_path(menu)
    return all(not disabled_folders.get(tuple(path[:index]), False) for index in range(1, len(path) + 1))


def expand_catalog(catalog: dict) -> list[dict]:
    disabled_items = set(catalog.get("disabled_items", []))
    disabled_items.update(item for item, parent in catalog.get("item_parents", {}).items() if parent in disabled_items)
    menus = [
        menu for menu in catalog["menus"]
        if is_menu_enabled(catalog, menu)
    ]
    entries = []
    for menu in menus:
        variants = [{"items": {}, "price": menu["base_price"]}]
        for group in menu["groups"]:
            group_variants = []
            for indexes in combinations_with_replacement(range(len(group["options"])), group["choose_count"]):
                items = {}
                price = 0
                for index in indexes:
                    option = group["options"][index]
                    item_name = POTATO_VECTOR if option["name"] in POTATO_QUANTITIES else option["name"]
                    item_quantity = catalog.get("item_quantities", {}).get(option["name"], option.get("quantity", POTATO_QUANTITIES.get(option["name"], 1)))
                    items[item_name] = items.get(item_name, 0) + item_quantity
                    price += option["price_delta"]
                group_variants.append({"items": items, "price": price})
            variants = [
                {
                    "items": {
                        **current["items"],
                        **{
                            name: current["items"].get(name, 0) + count
                            for name, count in next_variant["items"].items()
                        },
                    },
                    "price": current["price"] + next_variant["price"],
                }
                for current in variants
                for next_variant in group_variants
            ]
        entries.extend({
            **variant,
            "name": menu["name"],
            "path": menu_path(menu),
            "limit": menu["limit"],
            "attributes": menu.get("attributes", []),
            "requires_any_attributes": menu.get("requires_any_attributes", []),
        } for variant in variants if not disabled_items.intersection(variant["items"]))
    return entries


def solve(catalog: dict, target: dict[str, int], exact: bool = False) -> dict:
    normalized_target = {}
    for name, quantity in target.items():
        item_name = POTATO_VECTOR if name in POTATO_QUANTITIES else name
        item_quantity = quantity * catalog.get("item_quantities", {}).get(name, POTATO_QUANTITIES.get(name, 1))
        normalized_target[item_name] = normalized_target.get(item_name, 0) + item_quantity
    target = normalized_target
    if set(target).intersection(catalog.get("disabled_items", [])):
        return {"status": "Infeasible", "total_price": None}
    entries = expand_catalog(catalog)
    item_names = sorted(set(catalog["items"]) | set(target))
    problem = pulp.LpProblem("KFC_reference", pulp.LpMinimize)
    variables = [
        pulp.LpVariable(
            f"menu_{index}",
            lowBound=0,
            upBound=None if entry["limit"] == -1 else entry["limit"],
            cat=pulp.LpInteger,
        )
        for index, entry in enumerate(entries)
    ]
    problem += pulp.lpSum(entry["price"] * variables[index] for index, entry in enumerate(entries))
    for item_name in item_names:
        quantity = pulp.lpSum(entry["items"].get(item_name, 0) * variables[index] for index, entry in enumerate(entries))
        problem += quantity == target.get(item_name, 0) if exact else quantity >= target.get(item_name, 0)

    for entry_index, entry in enumerate(entries):
        required = set(entry["requires_any_attributes"])
        if not required:
            continue
        providers = [
            index for index, candidate in enumerate(entries)
            if required.intersection(candidate["attributes"])
        ]
        problem += variables[entry_index] <= MAX_INPUT_COUNT * pulp.lpSum(variables[index] for index in providers)

    status = problem.solve(pulp.PULP_CBC_CMD(msg=False))
    optimal = pulp.LpStatus[status] == "Optimal"
    return {
        "status": pulp.LpStatus[status],
        "total_price": int(pulp.value(problem.objective)) if optimal else None,
    }


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    catalog = json.loads((root / "config/menu_catalog.json").read_text(encoding="utf-8"))
    print(json.dumps(solve(catalog, {"オリジナルチキン": 1}), ensure_ascii=False))
