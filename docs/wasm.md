# WebAssembly の役割

最適化は `frontend/src/workers/optimizer.worker.js` からGLPK.jsを呼び出して実行します。GLPKのMILP計算とWASMバイナリはnpm依存としてフロントエンドに同梱され、ブラウザから外部サーバーへ問題データを送信しません。

Web Workerを挟むことで、計算中も画面の入力やスクロールを止めません。GLPKが返す整数変数をメニューの選択数へ変換し、既存の結果表示形式で表示します。

PuLPは `verification/pulp_reference.py` に残しています。フロントエンドと基準実装の結果を比較することで、WASM移行後もモデルの意味を検証できます。
