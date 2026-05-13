CXX := g++
CXXFLAGS := -std=c++20 -O2

TARGET := a.out
SRC := main.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	g++ $(CXXFLAGS) -o $(TARGET) $(SRC)

gen: $(TARGET)
	./generate.sh

clean:
	rm -rf tmp
	rm -f $(TARGET)
	rm -f menu.json

.PHONY: all gen clean