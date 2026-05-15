#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

# output_file: first arg (filename) or default 'menu.json'
# mode: second arg (lunch|normal|lunch_no_kids|normal_no_kids)
# output_dir: third arg or environment OUTPUT_DIR, default '.'
output_file="${1:-menu.json}"
mode="${2:-lunch}"
output_dir="${3:-${OUTPUT_DIR:-.}}"

mkdir -p "$output_dir"

# ensure output_file is placed into output_dir if it's a bare filename
if [ "$(dirname "$output_file")" = "." ]; then
    output_path="$output_dir/$output_file"
else
    output_path="$output_file"
fi

inputs=()

case "$mode" in
    normal)
        mapfile -t files < <(find menu_query -type f -name '*.in' ! -path 'menu_query/ランチメニュー/*' | sort)
        ;;
    lunch)
        mapfile -t files < <(find menu_query -type f -name '*.in' | sort)
        ;;
    normal_no_kids)
        mapfile -t files < <(find menu_query -type f -name '*.in' ! -path 'menu_query/ランチメニュー/*' ! -path 'menu_query/キッズメニュー/*' | sort)
        ;;
    lunch_no_kids)
        mapfile -t files < <(find menu_query -type f -name '*.in' ! -path 'menu_query/キッズメニュー/*' | sort)
        ;;
    *)
        echo "Unknown mode: $mode" >&2
        exit 1
        ;;
esac

for file in "${files[@]}"; do
    echo "Processing $file"

    json=$(./main.out < "$file")
    inputs+=("$json")
done

if [ ${#inputs[@]} -gt 0 ]; then
    printf '%s\n' "${inputs[@]}" | jq -s '.' > "$output_path"

    echo "Generated:"
    realpath "$output_path"
else
    echo "No .in files found."
fi