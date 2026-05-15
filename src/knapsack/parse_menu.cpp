#include "knapsack.hpp"

#include <fstream>
#include <stdexcept>

#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace {

std::vector<json> FlattenMenus(const json& rawData) {
    if (rawData.is_array() && !rawData.empty() && rawData.front().is_array()) {
        std::vector<json> flattened;
        for (const auto& group : rawData) {
            if (!group.is_array()) {
                continue;
            }
            for (const auto& item : group) {
                flattened.push_back(item);
            }
        }
        return flattened;
    }

    std::vector<json> menus;
    if (rawData.is_array()) {
        for (const auto& item : rawData) {
            menus.push_back(item);
        }
    }
    return menus;
}

Element ParseElement(const json& menu) {
    if (!menu.contains("name") || !menu["name"].is_string()) {
        throw std::runtime_error("menu entry is missing a string name");
    }
    if (!menu.contains("price") || !menu["price"].is_number_integer()) {
        throw std::runtime_error("menu entry is missing an integer price");
    }

    LatticeOrderedGroup group;
    if (menu.contains("items") && menu["items"].is_object()) {
        std::vector<Item> items;
        for (const auto& [itemName, value] : menu["items"].items()) {
            if (!value.is_number_integer()) {
                throw std::runtime_error("menu item count must be an integer");
            }
            items.push_back(Item{itemName, value.get<int>()});
        }
        group = LatticeOrderedGroup(items);
    }

    const int limit = menu.contains("limit") && menu["limit"].is_number_integer()
        ? menu["limit"].get<int>()
        : -1;

    return Element(
        group,
        menu["name"].get<std::string>(),
        menu["price"].get<int>(),
        limit
    );
}

} // namespace

std::vector<Element> LoadElementsFromJsonFile(const std::string& jsonPath) {
    std::ifstream input(jsonPath);
    if (!input.is_open()) {
        throw std::runtime_error("failed to open json file: " + jsonPath);
    }

    json rawData;
    input >> rawData;

    std::vector<Element> elements;
    for (const auto& menu : FlattenMenus(rawData)) {
        elements.push_back(ParseElement(menu));
    }
    return elements;
}


LatticeOrderedGroup LoadTargetFromJsonFile(const std::string& jsonPath) {
    std::ifstream input(jsonPath);
    if (!input.is_open()) {
        throw std::runtime_error("failed to open json file: " + jsonPath);
    }

    nlohmann::json rawData;
    input >> rawData;

    // Accept either an array of objects like ask_sample.json or a single object
    nlohmann::json obj;
    if (rawData.is_array()) {
        if (rawData.empty()) return LatticeOrderedGroup();
        obj = rawData.front();
    } else if (rawData.is_object()) {
        obj = rawData;
    } else {
        throw std::runtime_error("unexpected json format for target");
    }

    LatticeOrderedGroup group;
    if (obj.contains("items") && obj["items"].is_object()) {
        std::vector<Item> items;
        for (const auto& [name, val] : obj["items"].items()) {
            if (!val.is_number_integer()) throw std::runtime_error("item count must be integer");
            items.push_back(Item{name, val.get<int>()});
        }
        group = LatticeOrderedGroup(items);
    }
    return group;
}