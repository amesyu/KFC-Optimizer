#pragma once
#include <string>
#include <vector>
#include <map>

struct Item { std::string name; int count; };
bool operator<(const Item& a, const Item& b);

using ItemsMap = std::map<std::string, int>;
using Items = std::vector<Item>;

struct LatticeOrderedGroup : public std::vector<Item> {
public:
    using base = std::vector<Item>;
    LatticeOrderedGroup() = default;
    LatticeOrderedGroup(const base& items);
    LatticeOrderedGroup(std::initializer_list<Item> il);

    // 正規化: name でソートして同名は合算、count=0 は除去
    void normalize();
    // 全順序比較(mapでのキーにするために必要)
    bool less(const LatticeOrderedGroup& other) const;
    // meet は要素ごとの min を取る
    LatticeOrderedGroup meet(const LatticeOrderedGroup& other) const;
    // 加算は要素ごとの和を取る
    LatticeOrderedGroup operator+(const LatticeOrderedGroup& other) const;
    LatticeOrderedGroup operator-(const LatticeOrderedGroup& other) const;
    LatticeOrderedGroup operator*(int scalar) const;
    bool operator==(const LatticeOrderedGroup& other) const;
    LatticeOrderedGroup& operator+=(const LatticeOrderedGroup& other);
    LatticeOrderedGroup& operator-=(const LatticeOrderedGroup& other);
    operator std::string() const;
    using base::size;
    bool operator<(const LatticeOrderedGroup& other) const;
};

struct Element {
    LatticeOrderedGroup latticeOrderedGroup;
    std::string name;
    int price;
    int limit;

    Element();
    Element(const LatticeOrderedGroup& latticeOrderedGroup, std::string name, int price, int limit = -1);
    bool operator==(const Element& other) const;
};

#include <utility>
#include <vector>

std::pair<int, std::vector<Element>> MultiDimensionalKnapsackSolver(std::vector<Element>& menus, LatticeOrderedGroup& target, bool exact = true);
std::pair<bool, std::string> MultiDimensionalKnapsackSolver_Test();
