CXX := g++
CXXFLAGS := -std=c++20 -O2

TARGET := a.out
SRC := main.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	g++ $(CXXFLAGS) -o $(TARGET) $(SRC)

gen: $(TARGET)
	./generate.sh

gen_lunch: $(TARGET)
	./generate.sh menu_lunch.json lunch

gen_normal: $(TARGET)
	./generate.sh menu_normal.json normal

clean:
	rm -f $(TARGET)
	rm -f menu_lunch.json
	rm -f menu_normal.json

.PHONY: all gen gen_lunch gen_normal clean