# KFC-Optimizer

## Menu Generator

`src/menu_generator` では `make gen_all` だけを使います。

```bash
cd src/menu_generator
sudo apt-get update
sudo apt-get install -y nlohmann-json3-dev
make gen_all
```

`make gen_all` は次の JSON を `frontend/src/assets/` に生成します。

- `menu_lunch.json`
- `menu_normal.json`
- `menu_lunch_no_kids.json`
- `menu_normal_no_kids.json`
- `menu_names.json`

GitHub Actions のデプロイでも同じ手順を使います。

## Backend

Web API を動かすには Python 側の依存も入れます。`backend/` に置いています。

```bash
cd backend
python -m pip install -r requirements.txt
```

入るパッケージ:

- `fastapi`
- `uvicorn[standard]`
- `pulp`

バックエンド起動例:

```bash
cd backend
uvicorn web_app:app --reload --port 8000
```

## Frontend

フロントエンドは `frontend/` にあります。

```bash
cd frontend
npm install
npm run dev
```

ビルドする場合:

```bash
cd frontend
npm run build
```
