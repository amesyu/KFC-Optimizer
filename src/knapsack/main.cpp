#include <iostream>
#include <algorithm>
#include <vector>
#include <string>
#include <map>
#include <climits>

struct Item { std::string name; int count; };
bool operator<(const Item& a, const Item& b) {
    if (a.name != b.name) return a.name < b.name;
    return a.count < b.count;
}

using ItemsMap = std::map<std::string, int>;
using Items = std::vector<Item>;

struct LatticeOrderedGroup : public std::vector<Item> {
public:
    using base = std::vector<Item>;
    LatticeOrderedGroup() = default;
    LatticeOrderedGroup(const base& items) : base(items) { normalize(); }
    LatticeOrderedGroup(std::initializer_list<Item> il) : base(il) { normalize(); }

    // 正規化: name でソートして同名は合算、count=0 は除去
    void normalize() {
        std::sort(this->begin(), this->end(), [](const Item& a, const Item& b){
            if (a.name != b.name) return a.name < b.name;
            return a.count < b.count;
        });
        base merged;
        for (const auto& it : *this) {
            if (!merged.empty() && merged.back().name == it.name) {
                merged.back().count += it.count;
            } else {
                merged.push_back(it);
            }
        }
        // remove zero-count items
        base filtered;
        for (const auto& it : merged) if (it.count > 0) filtered.push_back(it);
        base::assign(filtered.begin(), filtered.end());
    }

    // 全順序比較(mapでのキーにするために必要)
    bool less(const LatticeOrderedGroup& other) const {
        return static_cast<const base&>(*this) < static_cast<const base&>(other);
    }

    // meet は要素ごとの min を取る
    LatticeOrderedGroup meet(const LatticeOrderedGroup& other) const {
        ItemsMap aMap, bMap;
        for (const auto& it : *this) aMap[it.name] = it.count;
        for (const auto& it : other) bMap[it.name] = it.count;
        std::vector<Item> newItems;
        for (const auto& [name, cnt] : aMap) {
            int m = std::min(cnt, bMap[name]);
            if (m > 0) newItems.push_back({name, m});
        }
        return LatticeOrderedGroup(newItems);
    }

    bool operator<(const LatticeOrderedGroup& other) const { return less(other); }

    // 加算は要素ごとの和を取る
    LatticeOrderedGroup operator+(const LatticeOrderedGroup& other) const {
        ItemsMap countMap;
        for (const auto& it : *this) countMap[it.name] += it.count;
        for (const auto& it : other) countMap[it.name] += it.count;
        std::vector<Item> newItems;
        for (auto& [name, count] : countMap) {
            if (count > 0) newItems.push_back({name, count});
        }
        return LatticeOrderedGroup(newItems);
    }

    LatticeOrderedGroup operator-(const LatticeOrderedGroup& other) const {
        ItemsMap countMap;
        for (const auto& it : *this) countMap[it.name] += it.count;
        for (const auto& it : other) countMap[it.name] -= it.count;
        std::vector<Item> newItems;
        for (auto& [name, count] : countMap) {
            if (count < 0) throw std::runtime_error("negative count in LatticeOrderedGroup subtraction");
            if (count > 0) newItems.push_back({name, count});
        }
        return LatticeOrderedGroup(newItems);
    }

    bool operator==(const LatticeOrderedGroup& other) const {
        return this->less(other) == false && other.less(*this) == false;
    }

    LatticeOrderedGroup& operator+=(const LatticeOrderedGroup& other) {
        *this = *this + other; return *this;
    }
    LatticeOrderedGroup& operator-=(const LatticeOrderedGroup& other) {
        *this = *this - other; return *this;
    }

    operator std::string() const {
        std::string s = "{";
        for (const auto& it : *this) {
            s += it.name + ": " + std::to_string(it.count) + ", ";
        }
        s += "}";
        return s;
    }

    using base::size;
};

struct Element {
    LatticeOrderedGroup latticeOrderedGroup;
    std::string name;
    int price;
    int limit;

    Element() = default;
    Element(const LatticeOrderedGroup& latticeOrderedGroup, std::string name, int price, int limit = -1) 
        : latticeOrderedGroup(latticeOrderedGroup), price(price), limit(limit) {}

    bool operator==(const Element& other) const {
        if (name != other.name) return false;
        if (price != other.price) return false;
        if (limit != other.limit) return false;
        return latticeOrderedGroup == other.latticeOrderedGroup;
    }
};

std::pair<int, std::vector<Element>> MultiDimensionalKnapsackSolver(std::vector<Element>& menus, LatticeOrderedGroup& target, bool exact = true) {
    // dp[State] = min price
    // sweep all state in lexicographical order if menu is unlimited
    // otherwise, reverse theo order
    std::map<LatticeOrderedGroup, int> dp;
    std::map<LatticeOrderedGroup, LatticeOrderedGroup> previous;
    std::map<LatticeOrderedGroup, Element> lastMenu;

    LatticeOrderedGroup state;
    std::vector<LatticeOrderedGroup> states;

    auto dfs = [&](auto&& self, int idx) -> void {
        if (idx == (int)target.size()) {
            states.push_back(state);
            return;
        }

        for (int cnt = 0; cnt <= target[idx].count; ++cnt) {
            LatticeOrderedGroup addVec{Item{target[idx].name, cnt}};
            state += addVec;
            self(self, idx + 1);
            state -= addVec;
        }
    };
    dfs(dfs, 0);

    for (const auto& st : states) dp[st] = INT_MAX;
    dp[LatticeOrderedGroup()] = 0;
    
    for (const auto& menu : menus) {
        int loopCount = (menu.limit == -1) ? 1 : menu.limit;
        for (int cnt = 0; cnt < loopCount; ++cnt) {
            for (int i = 0; i < (int)states.size(); ++i) {
                int idx = (menu.limit == -1) ? i : (int)states.size() - 1 - i;
                int loop = (menu.limit == -1) ? 1 : menu.limit;
                if (dp[states[idx]] == INT_MAX) continue;
                for (int cnt = 1; cnt <= loop; ++cnt) {
                    LatticeOrderedGroup nextState = (states[idx] + menu.latticeOrderedGroup);
                    LatticeOrderedGroup meetState = nextState.meet(target);
                    if (nextState != meetState && exact) continue;
                    if (dp[states[idx]] + menu.price < dp[meetState]) {
                        dp[meetState] = dp[states[idx]] + menu.price;
                        previous[meetState] = states[idx];
                        lastMenu[meetState] = menu;
                    }
                }
            }
        }
    }

    if (dp[target] == INT_MAX) {
        return std::make_pair(-1, std::vector<Element>());
    }

    std::vector<Element> result;
    LatticeOrderedGroup cur = target;
    while (cur.size() > 0) {
        const auto& menu = lastMenu[cur];
        result.push_back(menu);
        cur = previous[cur];
    }
    std::reverse(result.begin(), result.end());
    return std::make_pair(dp[target], result);
};

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

    for (const auto& [menus, target, exact, expected] : testCases) {
        auto [result, ansMenus] = MultiDimensionalKnapsackSolver(const_cast<std::vector<Element>&>(menus), const_cast<LatticeOrderedGroup&>(target), exact);
        if (result != expected.first || ansMenus != expected.second) {
            std::string failedMessage = "";
            for (const auto& menu : menus) {
                failedMessage += "Menu: " + menu.name + ", ";
                failedMessage += "Price: " + std::to_string(menu.price) + ", ";
                failedMessage += "Limit: " + std::to_string(menu.limit) + ", ";
                failedMessage += "Items: " + std::string(menu.latticeOrderedGroup) + "\n";
            }
            failedMessage += "Target: " + std::string(target) + ", Exact: " + std::to_string(exact) + "\n";
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
    } else {
        std::cout << message << std::endl;
    }
    return 0;
}