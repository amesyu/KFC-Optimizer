# KFC Optimizer

メニューを単品ベクトルとして表現し、必要個数を満たす最安の組み合わせをブラウザ内で計算します。RenderやAPIサーバーへの接続は不要です。

## 構成

```text
config/menu_catalog.json                 カタログの正本
frontend/src/domain/catalog.js           階層カタログ・ベクトル展開・入力制約
frontend/src/application/optimize.js     GLPKモデル生成・最適化
frontend/src/workers/optimizer.worker.js Web Workerの実行境界
frontend/src/catalogStore.js             同梱カタログとlocalStorage
frontend/src/components                  最適化画面とツリー型管理画面
verification/pulp_reference.py           PuLPによる検算用実装
```

最適化本体はGLPK.jsのWebAssembly、PuLPは同一カタログに対する検算用として残しています。

## 起動

```bash
cd frontend
npm install
npm run dev
```

本番ビルド:

```bash
cd frontend
npm run build
npm run preview
```

生成された `frontend/dist` をGitHub Pagesなどの静的ホスティングへ配置できます。

## 入力上限

単品の種類は最大100、各単品の数量は0〜1000、合計数量は1000までです。ポテトは画面上ではS/L/BOXから選び、最適化では`ポテト(g)`ベクトルへそれぞれ80g/160g/400gとして変換します。メニュー定義から生成するベクトル数にも上限を設けています。計算はWeb Workerで行うため、通常の画面操作をブロックしません。

## 管理画面

フロントエンドヘッダーの「管理画面」から、階層ツリー、単品ベクトル、単品の有効/無効、セットの選択グループ、選択個数、価格差を編集できます。階層単位で無効化でき、VS CodeのFoldersのように折りたたみできます。保存先はその端末のlocalStorageです。標準のランチ・ディナープリセットも用意しています。操作方法は [管理画面README](docs/admin/README.md) を参照してください。

mainブランチの公開カタログを更新する手順は [カタログ公開手順](docs/catalog-release.md) を参照してください。

## 検算

PuLPを使った基準実装を実行する場合:

```bash
python -m pip install -r verification/requirements.txt
python verification/pulp_reference.py
```
