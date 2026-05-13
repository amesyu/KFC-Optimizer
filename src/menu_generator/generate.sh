#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

shopt -s globstar nullglob

inputs=()

for file in menu_query/**/*.in; do
    echo "Processing $file"

    json=$(./a.out < "$file")
    inputs+=("$json")
done

if [ ${#inputs[@]} -gt 0 ]; then
    printf '%s\n' "${inputs[@]}" | jq -s '.' > menu.json

    echo "Generated:"
    realpath menu.json
else
    echo "No .in files found."
fi