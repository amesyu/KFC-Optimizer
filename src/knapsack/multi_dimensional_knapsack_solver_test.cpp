#include "knapsack.hpp"
#include <iostream>

std::pair<bool, std::string> MultiDimensionalKnapsackSolver_Test() {

    struct TestCase {
        std::vector<Element> menus;
        LatticeOrderedGroup target;
        int exact;
        std::pair<int, std::vector<Element>> expected;
    };

    std::vector<TestCase> testCases = {
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100),
                Element({Item{"B", 1}}, "B1", 150),
                Element({Item{"A", 1}, Item{"B", 1}}, "A1 & B1", 200)
            },
            .target = LatticeOrderedGroup({Item{"A", 1}, Item{"B", 1}}),
            .exact = false,
            .expected = {200, {Element({Item{"A", 1}, Item{"B", 1}}, "A1 & B1", 200)}}
        },
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100),
            },
            .target = LatticeOrderedGroup({Item{"C", 2}}),
            .exact = false,
            .expected = {-1, {}}
        },
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100, 1),
                Element({Item{"B", 1}}, "B1", 150, 3),
            },
            .target = LatticeOrderedGroup({Item{"A", 1}, Item{"B", 2}}),
            .exact = false,
            .expected = {400,
                {
                    Element({Item{"A", 1}}, "A1", 100, 1),
                    Element({Item{"B", 1}}, "B1", 150, 3),
                    Element({Item{"B", 1}}, "B1", 150, 3)
                }
            }
        },
        {
            .menus = {
                Element({Item{"A", 3}}, "A3", 150, -1),
                Element({Item{"A", 2}}, "A2", 100, -1),
            },
            .target = LatticeOrderedGroup({Item{"A", 1}}),
            .exact = true,
            .expected = {-1, {}}
        }
    };

    for (const auto& tc : testCases) {
        auto menus = tc.menus;
        auto target = tc.target;
        auto expected = tc.expected;
        auto [result, ansMenus] = MultiDimensionalKnapsackSolver(menus, target, tc.exact);
        if (result != expected.first || ansMenus != expected.second) {
            std::string failedMessage = "";
            for (const auto& menu : tc.menus) {
                failedMessage += "Menu: " + menu.name + ", ";
                failedMessage += "Price: " + std::to_string(menu.price) + ", ";
                failedMessage += "Limit: " + std::to_string(menu.limit) + ", ";
                failedMessage += "Items: " + std::string(menu.latticeOrderedGroup) + "\n";
            }
            failedMessage += "Target: " + std::string(tc.target) + ", Exact: " + std::to_string(tc.exact) + "\n";
            failedMessage += "Expected: " + std::to_string(expected.first) + ", Got: " + std::to_string(result) + "\n";
            failedMessage += "Answer Menus: \n";
            for (const auto& menu : ansMenus) {
                failedMessage += "  Menu: " + menu.name + ", ";
                failedMessage += "Price: " + std::to_string(menu.price) + ", ";
                failedMessage += "Limit: " + std::to_string(menu.limit) + ", ";
                failedMessage += "Items: " + std::string(menu.latticeOrderedGroup);
            }
            return {false, failedMessage};
        }
    }

    return {true, ""};
}

int main() {
    auto [success, message] = MultiDimensionalKnapsackSolver_Test();
    if (success) {
        std::cout << "All tests passed!" << std::endl;
        return 0;
    } else {
        std::cout << message << std::endl;
        return 1;
    }
}
