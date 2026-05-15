#include <iostream>
#include <fstream>
#include <vector>
#include <set>
#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

std::vector<json> flatten_menus(const json& raw_data) {
    if (raw_data.is_array() && raw_data.size() > 0 && raw_data[0].is_array()) {
        std::vector<json> flattened;
        for (const auto& group : raw_data) {
            if (group.is_array()) {
                for (const auto& item : group) {
                    flattened.push_back(item);
                }
            }
        }
        return flattened;
    }
    
    std::vector<json> result;
    if (raw_data.is_array()) {
        for (const auto& item : raw_data) {
            result.push_back(item);
        }
    }
    return result;
}

std::set<std::string> collect_item_names(const std::vector<std::string>& paths) {
    std::set<std::string> item_names;
    
    for (const auto& path : paths) {
        std::ifstream file(path, std::ios::in);
        if (!file.is_open()) {
            std::cerr << "missing: " << path << std::endl;
            continue;
        }
        
        json raw_data;
        try {
            file >> raw_data;
        } catch (const std::exception& e) {
            std::cerr << "error reading " << path << ": " << e.what() << std::endl;
            continue;
        }
        
        auto menus = flatten_menus(raw_data);
        for (const auto& menu : menus) {
            if (menu.contains("items") && menu["items"].is_object()) {
                for (auto& [key, value] : menu["items"].items()) {
                    item_names.insert(key);
                }
            }
        }
    }
    
    return item_names;
}

int main(int argc, char* argv[]) {
    std::vector<std::string> paths;
    
    for (int i = 1; i < argc; ++i) {
        paths.push_back(argv[i]);
    }
    
    auto item_names = collect_item_names(paths);
    
    json output;
    output["items"] = std::vector<std::string>(item_names.begin(), item_names.end());
    
    std::cout << output.dump(2) << std::endl;
    
    return 0;
}
