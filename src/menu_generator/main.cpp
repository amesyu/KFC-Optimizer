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
        *this = *this + other; 
        this->normalize();
        return *this;
    }
    LatticeVector& operator-=(const LatticeVector& other) {
        *this = *this - other;
        this->normalize();
        return *this;
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
    int price;
    int limit;

    Element() = default;
    Element(const LatticeVector& latticeVector, int price, int limit = -1) 
        : latticeVector(latticeVector), price(price), limit(limit) {}
};

using Menu = std::pair<LatticeVector, int>;

std::vector<Menu> Homogeneous(std::vector<std::pair<std::string, int>> items, int count) {
    std::vector<Menu> result;

    LatticeVector current;
    int additionalPrice = 0;
    auto solve = [&](auto&& self, int idx, int remaining) -> void {
        if (idx == (int)items.size()) {
            if (remaining == 0) result.push_back(Menu(current, additionalPrice));
            return;
        }
        for (int cnt = remaining; cnt >= 0; --cnt) {
            LatticeVector addVec{Item{items[idx].first, cnt}};
            current += addVec;
            additionalPrice += items[idx].second * cnt;
            self(self, idx + 1, remaining - cnt);
            current -= addVec;
            additionalPrice -= items[idx].second * cnt;
        }
    };

    solve(solve, 0, count);
    return result;
}

std::vector<Menu> Product(const std::vector<Menu>& menus1, const std::vector<Menu>& menus2) {
    std::vector<Menu> result;
    for (const auto& [vec1, price1] : menus1) {
        for (const auto& [vec2, price2] : menus2) {
            result.push_back({vec1 + vec2, price1 + price2});
        }
    }
    return result;
}


int main() {
    std::string menuName; std::cin >> menuName;
    int basePrice; std::cin >> basePrice;
    int limit; std::cin >> limit;
    int N; std::cin >> N;

    std::vector<std::pair<LatticeVector, int>> result = {make_pair(LatticeVector(), basePrice)};
    for (int i = 0; i < N; ++i) {
        int M; std::cin >> M;
        std::vector<std::pair<std::string, int>> items(M);
        for (int j = 0; j < M; ++j) std::cin >> items[j].first;
        for (int j = 0; j < M; ++j) std::cin >> items[j].second;
        int count; std::cin >> count;
        auto homogeneousMenus = Homogeneous(items, count);
        result = Product(result, homogeneousMenus);
    }

    std::cerr << "Generated " << result.size() << " menu combinations." << std::endl;

    // json形式で出力
    std::cout << "[\n";
    for (size_t i = 0; i < result.size(); ++i) {
        const auto& [vec, price] = result[i];
        std::cout << "  {\n";
        std::cout << "    \"name\": \"" << menuName << "\",\n";
        std::cout << "    \"price\": " << price << ",\n";
        std::cout << "    \"limit\": " << limit << ",\n";
        std::cout << "    \"items\": {\n";
        for (size_t j = 0; j < vec.size(); ++j) {
            const auto& item = vec[j];
            std::cout << "      \"" << item.name << "\": " << item.count;
            if (j + 1 < vec.size()) std::cout << ",";
            std::cout << "\n"; 
        }
        std::cout << "    }\n";
        std::cout << "  }";
        if (i + 1 < result.size()) std::cout << ",";
        std::cout << "\n";
    }
    std::cout << "]\n";
}