# PuLP検算ツール

本番の最適化はフロントエンドのGLPK.js（WebAssembly）が担当します。PuLPは同じカタログと制約で結果を比較するための基準実装として残しています。メニュー属性と属性による購入条件も検算します。

```bash
python -m pip install -r verification/requirements.txt
python verification/pulp_reference.py
```
