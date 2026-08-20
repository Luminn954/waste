# ============================================================
#  database.py – Koneksi SQLite + buat semua tabel
# ============================================================

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# File database SQLite disimpan di folder backend
DATABASE_URL = "sqlite:///./smart_waste.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # perlu untuk SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency – buka sesi DB, lalu tutup otomatis setelah request selesai."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
