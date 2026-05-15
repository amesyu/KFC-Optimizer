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

    LatticeOrderedGroup operator*(int scalar) const {
        std::vector<Item> newItems;
        for (const auto& it : *this) {
            if (scalar * it.count > 0) newItems.push_back({it.name, scalar * it.count});
        }
        return LatticeOrderedGroup(newItems);
    }

    bool operator==(const LatticeOrderedGroup& other) const {
        return this->less(other) == false && other.less(*this) == false;
    }

    LatticeOrderedGroup& operator+=(const LatticeOrderedGroup& other) {
        *this = *this + other; 
        this->normalize();
        return *this;
    }
    LatticeOrderedGroup& operator-=(const LatticeOrderedGroup& other) {
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
    LatticeOrderedGroup latticeOrderedGroup;
    std::string name;
    int price;
    int limit;

    Element() = default;
    Element(const LatticeOrderedGroup& latticeOrderedGroup, std::string name, int price, int limit = -1) 
        : latticeOrderedGroup(latticeOrderedGroup), name(name), price(price), limit(limit) {}

    bool operator==(const Element& other) const {
        if (name != other.name) return false;
        if (price != other.price) return false;
        if (limit != other.limit) return false;
        return latticeOrderedGroup == other.latticeOrderedGroup;
    }
};

using Menu = std::pair<LatticeOrderedGroup, int>;

std::vector<Menu> Homogeneous(std::vector<std::pair<std::string, int>> items, int count) {
    std::vector<Menu> result;

    LatticeOrderedGroup current;
    int additionalPrice = 0;
    auto solve = [&](auto&& self, int idx, int remaining) -> void {
        if (idx == (int)items.size()) {
            if (remaining == 0) result.push_back(Menu(current, additionalPrice));
            return;
        }
        for (int cnt = remaining; cnt >= 0; --cnt) {
            LatticeOrderedGroup addVec{Item{items[idx].first, cnt}};
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

Element ConvertToElement(std::string menuName, int limit, std::pair<LatticeOrderedGroup, int> menu) {
    Element element(
        menu.first,
        menuName,
        menu.second,
        limit
    );
    return element;
}

void OutputMenu(const std::vector<Element>& elements, std::ostream& out) {
    out << "[\n";
    for (size_t i = 0; i < elements.size(); ++i) {
        auto [vec, name, price, limit] = elements[i];
        out << "  {\n";
        out << "    \"name\": \"" << name << "\",\n";
        out << "    \"limit\": " << limit << ",\n";
        out << "    \"price\": " << price << ",\n";
        out << "    \"items\": {\n";
        for (size_t j = 0; j < vec.size(); ++j) {
            const auto& item = vec[j];
            out << "      \"" << item.name << "\": " << item.count;
            if (j + 1 < vec.size()) out << ",";
            out << "\n"; 
        }
        out << "    }\n";
        out << "  }";
        if (i + 1 < elements.size()) out << ",";
        out << "\n";
    }
    out << "]\n";

}

int main(int argc, char* argv[]) {
    std::string menuName; std::cin >> menuName;
    int basePrice; std::cin >> basePrice;
    int limit; std::cin >> limit;
    int N; std::cin >> N;

    std::vector<std::pair<LatticeOrderedGroup, int>> result = {
        std::make_pair(LatticeOrderedGroup(), basePrice)
    };

    for (int i = 0; i < N; ++i) {
        int M; std::cin >> M;
        std::vector<std::pair<std::string, int>> items(M);
        for (int j = 0; j < M; ++j) std::cin >> items[j].first;
        for (int j = 0; j < M; ++j) std::cin >> items[j].second;
        int count; std::cin >> count;
        auto homogeneousMenus = Homogeneous(items, count);
        result = Product(result, homogeneousMenus);
    }

    std::vector<Element> elements;
    for (const auto& menu : result) {
        elements.push_back(ConvertToElement(menuName, limit, menu));
    }
    
    OutputMenu(elements, std::cout);
    
    std::cerr << "Generated " << result.size() << " menu combinations." << std::endl;

}