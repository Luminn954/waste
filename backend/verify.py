import sys, os
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 45)
print("  VERIFIKASI BACKEND SMART WASTE")
print("=" * 45)

errors = []

# 1. Cek library
try:
    import fastapi
    print(f"  [OK] fastapi     {fastapi.__version__}")
except ImportError as e:
    errors.append(str(e)); print(f"  [FAIL] fastapi: {e}")

try:
    import uvicorn
    print(f"  [OK] uvicorn     {uvicorn.__version__}")
except ImportError as e:
    errors.append(str(e)); print(f"  [FAIL] uvicorn: {e}")

try:
    import sqlalchemy
    print(f"  [OK] sqlalchemy  {sqlalchemy.__version__}")
except ImportError as e:
    errors.append(str(e)); print(f"  [FAIL] sqlalchemy: {e}")

# 2. Cek database.py
try:
    from database import engine, Base, get_db
    print("  [OK] database.py")
except Exception as e:
    errors.append(str(e)); print(f"  [FAIL] database.py: {e}")

# 3. Cek models.py
try:
    import models
    tabel = list(models.Base.metadata.tables.keys())
    print(f"  [OK] models.py   tables: {tabel}")
except Exception as e:
    errors.append(str(e)); print(f"  [FAIL] models.py: {e}")

# 4. Buat tabel di SQLite
try:
    from database import engine, Base
    import models
    Base.metadata.create_all(bind=engine)
    print("  [OK] SQLite DB   smart_waste.db dibuat/diperbarui")
except Exception as e:
    errors.append(str(e)); print(f"  [FAIL] create_all: {e}")

# 5. Cek main.py (import app FastAPI)
try:
    import main
    routes = [r.path for r in main.app.routes if hasattr(r, "path")]
    print(f"  [OK] main.py     {len(routes)} endpoint terdaftar")
    for r in routes:
        print(f"       {r}")
except Exception as e:
    errors.append(str(e)); print(f"  [FAIL] main.py: {e}")

print("=" * 45)
if errors:
    print(f"  ADA {len(errors)} ERROR! Periksa di atas.")
else:
    print("  SEMUA OK! Backend siap dijalankan.")
    print()
    print("  Cara menjalankan backend:")
    print("  > python -m uvicorn main:app --reload")
    print()
    print("  Lalu buka frontend:")
    print("  > frontend/index.html (klik kanan -> Open with Browser)")
print("=" * 45)
