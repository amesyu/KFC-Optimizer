CXX := g++
CXXFLAGS := -std=c++20 -O2

TARGET := main.out
NAME_GEN := menu_names_gen.out
SRC := menu_generator.cpp

# OUTPUT_DIR can be set from environment or make command line.
# Default to frontend assets so running 'make gen_all' from this folder
# populates frontend/src/assets.
OUTPUT_DIR ?= ../../frontend/src/assets

all: gen_all

$(TARGET): $(SRC)
	g++ $(CXXFLAGS) -o $(TARGET) $(SRC)

$(NAME_GEN): menu_names_generator.cpp
	g++ $(CXXFLAGS) -o $(NAME_GEN) menu_names_generator.cpp

gen_all: $(TARGET) $(NAME_GEN)
	mkdir -p $(OUTPUT_DIR)
	./generate.sh menu_lunch.json lunch $(OUTPUT_DIR)
	./generate.sh menu_normal.json normal $(OUTPUT_DIR)
	./generate.sh menu_lunch_no_kids.json lunch_no_kids $(OUTPUT_DIR)
	./generate.sh menu_normal_no_kids.json normal_no_kids $(OUTPUT_DIR)
	./$(NAME_GEN) $(OUTPUT_DIR)/menu_lunch.json $(OUTPUT_DIR)/menu_normal.json $(OUTPUT_DIR)/menu_lunch_no_kids.json $(OUTPUT_DIR)/menu_normal_no_kids.json > $(OUTPUT_DIR)/menu_names.json

.PHONY: all gen_all