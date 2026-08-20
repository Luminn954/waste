# ============================================================
#  models.py – Semua tabel database (ORM SQLAlchemy)
# ============================================================

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


# ─────────────────────────────────────────
# Tabel: sampah
# ─────────────────────────────────────────
class Sampah(Base):
    __tablename__ = "sampah"

    id             = Column(Integer, primary_key=True, index=True)
    jenis          = Column(String(50), nullable=False)   # Organik / Anorganik / B3
    berat_kg       = Column(Float, nullable=False)
    lokasi         = Column(String(200), nullable=False)
    tingkat_bahaya = Column(String(20), nullable=False)   # RENDAH / SEDANG / TINGGI
    sudah_diambil  = Column(Boolean, default=False)
    dibuat_pada    = Column(DateTime, default=datetime.now)


# ─────────────────────────────────────────
# Tabel: tpa (tempat pembuangan akhir)
# ─────────────────────────────────────────
class TPA(Base):
    __tablename__ = "tpa"

    id                         = Column(Integer, primary_key=True, index=True)
    nama                       = Column(String(100), nullable=False)
    kapasitas_ton              = Column(Float, nullable=False)
    terisi_ton                 = Column(Float, default=0.0)
    tgl_terakhir_dikosongkan   = Column(String(50), default="-")


# ─────────────────────────────────────────
# Tabel: petugas
# ─────────────────────────────────────────
class Petugas(Base):
    __tablename__ = "petugas"

    id           = Column(Integer, primary_key=True, index=True)
    nama         = Column(String(100), nullable=False)
    zona_tugas   = Column(String(100), nullable=False)
    total_ambil  = Column(Integer, default=0)
    status_aktif = Column(Boolean, default=True)


# ─────────────────────────────────────────
# Tabel: kendaraan
# ─────────────────────────────────────────
class Kendaraan(Base):
    __tablename__ = "kendaraan"

    id            = Column(Integer, primary_key=True, index=True)
    plat_nomor    = Column(String(20), unique=True, nullable=False)
    kapasitas_kg  = Column(Float, nullable=False)
    muatan_kg     = Column(Float, default=0.0)
    kondisi       = Column(String(20), default="Baik")  # Baik / Servis
    rute          = Column(Text, default="")            # disimpan sebagai string dipisah koma


# ─────────────────────────────────────────
# Tabel: laporan_harian
# ─────────────────────────────────────────
class LaporanHarian(Base):
    __tablename__ = "laporan_harian"

    id              = Column(Integer, primary_key=True, index=True)
    tanggal         = Column(String(50), nullable=False)
    total_sampah    = Column(Integer, default=0)
    total_berat_kg  = Column(Float, default=0.0)
    catatan         = Column(Text, default="")      # JSON string list
    peringatan      = Column(Text, default="")      # JSON string list
    dibuat_pada     = Column(DateTime, default=datetime.now)
