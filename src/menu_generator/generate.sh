#!/usr/bin/env bash

set -euo pipefail

# スクリプトのある場所へ移動
cd "$(dirname "$0")"

mkdir -p tmp

shopt -s globstar nullglob

json_files=()

# menu_query 以下の .in を再帰的に処理
for file in menu_query/**/*.in; do
    # menu_query/ を除去
    rel="${file#menu_query/}"

    # / を _ に変換
    base="${rel//\//_}"

    # tmp/a_b_c.json の形にする
    json_file="tmp/${base%.in}.json"

    echo "Processing $file -> $json_file"

    ./a.out < "$file" > "$json_file"

    json_files+=("$json_file")
done

# すべての JSON を menu.json に結合
if [ ${#json_files[@]} -gt 0 ]; then
    jq -s '.' "${json_files[@]}" > menu.json

    echo "Merged JSON written to:"
    realpath menu.json
else
    echo "No .in files found."
fi