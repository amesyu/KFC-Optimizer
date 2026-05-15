import json
import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse


BASE_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(BASE_DIR, "src")
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

try:
    from knapsack.lp_solver import solve_menu_optimization
except Exception as exc:
    solve_menu_optimization = None
    IMPORT_ERROR = str(exc)
else:
    IMPORT_ERROR = None


app = FastAPI(title="KFC LP Solver API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_builtin_menu(menu_file: str, exclude_kids: bool = False):
    if menu_file not in ("normal", "lunch"):
        raise ValueError("menu_file must be 'normal' or 'lunch'")

    suffix = "_no_kids" if exclude_kids else ""
    filename = f"menu_{menu_file}{suffix}.json"
    asset_path = os.path.join(BASE_DIR, "frontend", "src", "assets", filename)
    if not os.path.exists(asset_path):
        raise FileNotFoundError(f"asset not found: {asset_path}")

    with open(asset_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/")
def index():
    dist_index = os.path.join(BASE_DIR, "frontend", "dist", "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index, media_type="text/html")

    template_path = os.path.join(BASE_DIR, "templates", "index.html")
    if os.path.exists(template_path):
        return HTMLResponse(open(template_path, "r", encoding="utf-8").read())

    return HTMLResponse("<h1>Index not found</h1>")


@app.post("/solve")
async def solve(request: Request):
    if solve_menu_optimization is None:
        return JSONResponse({"error": "solver import failed", "detail": IMPORT_ERROR}, status_code=500)

    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    menu_data = data.get("menu_data")
    menu_file = data.get("menu_file")
    exclude_kids = bool(data.get("exclude_kids", False))
    target = data.get("target")
    exact = bool(data.get("exact", False))

    if menu_data is None:
        try:
            menu_data = load_builtin_menu(menu_file, exclude_kids)
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=500)

    if target is None:
        return JSONResponse({"error": "target is required"}, status_code=400)

    try:
        return JSONResponse(solve_menu_optimization(menu_data, target, exact))
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)
