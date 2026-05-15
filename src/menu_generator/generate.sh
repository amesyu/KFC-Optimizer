#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

output_file="${1:-menu.json}"
mode="${2:-lunch}"

inputs=()

if [ "$mode" = "normal" ]; then
    mapfile -t files < <(find menu_query -type f -name '*.in' ! -path 'menu_query/ランチメニュー/*' | sort)
else
    mapfile -t files < <(find menu_query -type f -name '*.in' | sort)
fi

for file in "${files[@]}"; do
    echo "Processing $file"

    json=$(./main.out < "$file")
    inputs+=("$json")
done

if [ ${#inputs[@]} -gt 0 ]; then
    printf '%s\n' "${inputs[@]}" | jq -s '.' > "$output_file"

    echo "Generated:"
    realpath "$output_file"
else
    echo "No .in files found."
fi