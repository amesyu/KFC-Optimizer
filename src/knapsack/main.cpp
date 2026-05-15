#include "knapsack.hpp"

#include <iostream>
#include <map>
#include <string>
#include <vector>

int main() {
	const std::string menusPath = "../menu_generator/menu_lunch.json";
	const std::string targetPath = "../menu_generator/ask_sample.json_sample";

	try {
		auto menus = LoadElementsFromJsonFile(menusPath);
		auto target = LoadTargetFromJsonFile(targetPath);

		auto [totalPrice, selection] = MultiDimensionalKnapsackSolver(menus, target, false);
		if (totalPrice < 0) {
			std::cout << "No solution found." << std::endl;
			return 1;
		}

		// Aggregate identical Element instances and count occurrences (preserve distinct menu variants)
		std::vector<std::pair<Element, int>> agg;
		for (const auto& e : selection) {
			bool found = false;
			for (auto& p : agg) {
				if (p.first == e) { p.second++; found = true; break; }
			}
			if (!found) agg.emplace_back(e, 1);
		}

		std::cout << "Total price: " << totalPrice << std::endl;
		for (const auto& [elem, cnt] : agg) {
			std::cout << "* " << elem.name << " x " << cnt << " (" << elem.price << "円/個)" << std::endl;
			for (const auto& it : elem.latticeOrderedGroup) {
				int totalQty = it.count * cnt;
				std::cout << "    + " << it.name << ": " << it.count << "個 (計 " << totalQty << "個)" << std::endl;
			}
		}

		return 0;
	} catch (const std::exception& ex) {
		std::cerr << "Error: " << ex.what() << std::endl;
		return 2;
	}
}

