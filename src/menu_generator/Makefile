CXX := g++
CXXFLAGS := -std=c++20 -O2

TARGET := main.out
NAME_GEN := menu_names_gen.out
SRC := main.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	g++ $(CXXFLAGS) -o $(TARGET) $(SRC)

$(NAME_GEN): menu_names_generator.cpp
	g++ $(CXXFLAGS) -o $(NAME_GEN) menu_names_generator.cpp

gen: $(TARGET)
	./generate.sh

gen_lunch: clean $(TARGET) $(NAME_GEN)
	./generate.sh menu_lunch.json lunch
	./$(NAME_GEN) menu_lunch.json > menu_names.json

gen_normal: clean $(TARGET) $(NAME_GEN)
	./generate.sh menu_normal.json normal
	./$(NAME_GEN) menu_normal.json > menu_names.json

clean_gen:
	rm -f $(TARGET)
	rm -f $(NAME_GEN)

clean:
	rm -f $(TARGET)
	rm -f $(NAME_GEN)
	rm -f menu_lunch.json
	rm -f menu_normal.json
	rm -f menu_names.json

.PHONY: all gen gen_lunch gen_normal clean_gen clean