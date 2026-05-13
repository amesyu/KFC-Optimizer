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

struct LatticeVector : public std::vector<Item> {
public:
    using base = std::vector<Item>;
    LatticeVector() = default;
    LatticeVector(const base& items) : base(items) { normalize(); }
    LatticeVector(std::initializer_list<Item> il) : base(il) { normalize(); }

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
    bool less(const LatticeVector& other) const {
        return static_cast<const base&>(*this) < static_cast<const base&>(other);
    }

    // meet は要素ごとの min を取る
    LatticeVector meet(const LatticeVector& other) const {
        ItemsMap aMap, bMap;
        for (const auto& it : *this) aMap[it.name] = it.count;
        for (const auto& it : other) bMap[it.name] = it.count;
        std::vector<Item> newItems;
        for (const auto& [name, cnt] : aMap) {
            int m = std::min(cnt, bMap[name]);
            if (m > 0) newItems.push_back({name, m});
        }
        return LatticeVector(newItems);
    }

    bool operator<(const LatticeVector& other) const { return less(other); }

    // 加算は要素ごとの和を取る
    LatticeVector operator+(const LatticeVector& other) const {
        ItemsMap countMap;
        for (const auto& it : *this) countMap[it.name] += it.count;
        for (const auto& it : other) countMap[it.name] += it.count;
        std::vector<Item> newItems;
        for (auto& [name, count] : countMap) {
            if (count > 0) newItems.push_back({name, count});
        }
        return LatticeVector(newItems);
    }

    LatticeVector operator-(const LatticeVector& other) const {
        ItemsMap countMap;
        for (const auto& it : *this) countMap[it.name] += it.count;
        for (const auto& it : other) countMap[it.name] -= it.count;
        std::vector<Item> newItems;
        for (auto& [name, count] : countMap) {
            if (count < 0) throw std::runtime_error("negative count in LatticeVector subtraction");
            if (count > 0) newItems.push_back({name, count});
        }
        return LatticeVector(newItems);
    }

    LatticeVector operator*(int scalar) const {
        std::vector<Item> newItems;
        for (const auto& it : *this) {
            if (scalar * it.count > 0) newItems.push_back({it.name, scalar * it.count});
        }
        return LatticeVector(newItems);
    }

    bool operator==(const LatticeVector& other) const {
        return this->less(other) == false && other.less(*this) == false;
    }

    LatticeVector& operator+=(const LatticeVector& other) {
        *this = *this + other; return *this;
    }
    LatticeVector& operator-=(const LatticeVector& other) {
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
    LatticeVector latticeVector;
    std::string name;
    int price;
    int limit;

    Element() = default;
    Element(const LatticeVector& latticeVector, std::string name, int price, int limit = -1) 
        : latticeVector(latticeVector), price(price), limit(limit) {}
};

int MultiDimensionalKnapsackSolver(std::vector<Element>& menus, LatticeVector& target, bool exact = true) {
    // dp[State] = min price
    // sweep all state in lexicographical order if menu is unlimited
    // otherwise, reverse theo order
    std::map<LatticeVector, int> dp;
    std::map<LatticeVector, LatticeVector> previous;
    std::map<LatticeVector, Element> lastMenu;

    LatticeVector state;
    std::vector<LatticeVector> states;

    auto dfs = [&](auto&& self, int idx) -> void {
        if (idx == (int)target.size()) {
            states.push_back(state);
            return;
        }

        for (int cnt = 0; cnt <= target[idx].count; ++cnt) {
            LatticeVector addVec{Item{target[idx].name, cnt}};
            state += addVec;
            self(self, idx + 1);
            state -= addVec;
        }
    };
    dfs(dfs, 0);

    for (const auto& st : states) dp[st] = INT_MAX;
    dp[LatticeVector()] = 0;
    
    for (const auto& menu : menus) {
        for (int i = 0; i < (int)states.size(); ++i) {
            int idx = (menu.limit == -1) ? i : (int)states.size() - 1 - i;
            int loop = (menu.limit == -1) ? 1 : menu.limit;
            if (dp[states[idx]] == INT_MAX) continue;
            for (int cnt = 1; cnt <= loop; ++cnt) {
                LatticeVector nextState = (states[idx] + menu.latticeVector * cnt);
                LatticeVector meetState = nextState.meet(target);
                if (nextState != meetState && exact) continue;
                if (dp[states[idx]] + menu.price * cnt < dp[meetState]) {
                    dp[meetState] = dp[states[idx]] + menu.price * cnt;
                    previous[meetState] = states[idx];
                    lastMenu[meetState] = menu;
                }
            }
        }
    }

    return dp[target] == INT_MAX ? -1 : dp[target];
};

std::pair<bool, std::string> MultiDimensionalKnapsackSolver_Test() {

    struct TestCase {
        std::vector<Element> menus;
        LatticeVector target;
        int exact;
        int expected;
    };

    std::vector<TestCase> testCases = {
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100),
                Element({Item{"B", 1}}, "B1", 150),
                Element({Item{"A", 1}, Item{"B", 1}}, "A1 & B1", 200)
            },
            .target = LatticeVector({Item{"A", 1}, Item{"B", 1}}),
            .exact = false,
            .expected = 200
        },
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100),
            },
            .target = LatticeVector({Item{"C", 2}}),
            .exact = false,
            .expected = -1
        },
        {
            .menus = {
                Element({Item{"A", 1}}, "A1", 100, 1),
                Element({Item{"B", 1}}, "B1", 150, 3),
            },
            .target = LatticeVector({Item{"A", 1}, Item{"B", 2}}),
            .exact = false,
            .expected = 400
        },
        {
            .menus = {
                Element({Item{"A", 3}}, "A3", 150, -1),
                Element({Item{"A", 2}}, "A2", 100, -1),
            },
            .target = LatticeVector({Item{"A", 1}}),
            .exact = true,
            .expected = -1
        }
    };

    for (const auto& [menus, target, exact, expected] : testCases) {
        int result = MultiDimensionalKnapsackSolver(const_cast<std::vector<Element>&>(menus), const_cast<LatticeVector&>(target), exact);
        if (result != expected) {
            for (const auto& menu : menus) {
                std::cout << "Menu: " << menu.name << " | ";
                for (const auto& item : menu.latticeVector) {
                    std::cout << item.name << " x" << item.count << " ";
                }
                std::cout << "Price: " << menu.price << " Limit: " << menu.limit << std::endl;
            }
            std::cout << "Target: ";
            for (const auto& item : target) {
                std::cout << item.name << " x" << item.count << " ";
            }
            std::cout << "Exact: " << exact << std::endl;
            return {false, "Test failed: expected " + std::to_string(expected) + ", got " + std::to_string(result)};
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