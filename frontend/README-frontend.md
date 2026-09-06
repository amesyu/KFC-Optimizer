# Frontend

React + Vite のSPAです。カタログと最適化処理をすべて同梱するため、APIサーバーなしで静的ホスティングできます。

```bash
npm install
npm run dev
npm run build
```

最適化はWeb Worker内のGLPK.js（WebAssembly）で実行します。カタログ編集結果と名前付きプリセットは端末のlocalStorageに保存されます。ヘッダーからランチ・ディナープリセットをロードできます。
