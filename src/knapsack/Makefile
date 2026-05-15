CXX := g++
CXXFLAGS := -std=c++20 -O2 -I.

SRCS := main.cpp parse_menu.cpp multi_dimensional_knapsack_solver.cpp
OBJS := $(SRCS:.cpp=.o)

TARGET := main.out

all: $(TARGET)

%.o: %.cpp knapsack.hpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all run clean
