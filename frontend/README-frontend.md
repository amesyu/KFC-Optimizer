# KFC-Optimizer — Frontend

Run a small FastAPI app that exposes the LP solver used by `lp_solver.py`.

Setup

```bash
cd KFC-Optimizer
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Run (backend)

```bash
uvicorn backend.web_app:app --reload --port 8000
```

During development open the frontend dev server (see below). After building the frontend (`npm run build`) the backend will serve the built SPA at `http://localhost:8000/`.

Frontend (Vite + React)

Development

1. Start the backend API (so the dev server can proxy `/solve`):

```bash
cd KFC-Optimizer
source .venv/bin/activate
uvicorn backend.web_app:app --reload --port 8000
```

2. In a separate terminal, run the frontend dev server:

```bash
cd KFC-Optimizer/frontend
npm install
npm run dev
```

The Vite dev server proxies `/solve` to `http://localhost:8000` so API calls from the SPA work during development.

Build

```bash
cd KFC-Optimizer/frontend
npm run build
```

When `frontend/dist` exists the backend will serve the built SPA at `http://localhost:8000/`.
