# ============================================================
#  main.py – FastAPI Backend Smart Waste Management System
#  Jalankan: python -m uvicorn main:app --reload
#  API Docs: http://localhost:8000/docs
# ============================================================

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json, io, csv

from database import engine, get_db, Base
import models

# Buat semua tabel di database saat pertama kali jalan
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Waste API", version="1.0.0")

# Izinkan frontend mengakses backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
#  SCHEMA (validasi data masuk dari frontend)
# ============================================================

class SampahBuat(BaseModel):
    jenis: str
    berat_kg: float
    lokasi: str

class SampahEdit(BaseModel):
    jenis: Optional[str] = None
    berat_kg: Optional[float] = None
    lokasi: Optional[str] = None

class SampahUpdateBerat(BaseModel):
    berat_kg: float

class TPABuat(BaseModel):
    nama: str
    kapasitas_ton: float

class PetugasBuat(BaseModel):
    nama: str
    zona_tugas: str

class KendaraanBuat(BaseModel):
    plat_nomor: str
    kapasitas_kg: float

class LaporanBuat(BaseModel):
    tanggal: str

class PeringatanTambah(BaseModel):
    pesan: str


# ============================================================
#  HELPER
# ============================================================

def set_bahaya(jenis: str) -> str:
    if jenis == "B3":
        return "TINGGI"
    elif jenis == "Anorganik":
        return "SEDANG"
    return "RENDAH"


# ============================================================
#  ENDPOINT: ROOT & DASHBOARD
# ============================================================

@app.get("/")
def root():
    return {"pesan": "Smart Waste API berjalan!", "docs": "/docs"}


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    """Statistik ringkas untuk halaman utama frontend."""
    total_sampah      = db.query(models.Sampah).count()
    belum_diambil     = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == False).count()
    sudah_diambil     = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == True).count()
    total_petugas     = db.query(models.Petugas).count()
    petugas_aktif     = db.query(models.Petugas).filter(models.Petugas.status_aktif == True).count()
    total_kendaraan   = db.query(models.Kendaraan).count()
    kendaraan_servis  = db.query(models.Kendaraan).filter(models.Kendaraan.kondisi == "Servis").count()
    total_tpa         = db.query(models.TPA).count()

    # Hitung total berat sampah yang sudah diambil
    semua_sampah      = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == True).all()
    total_berat       = sum(s.berat_kg for s in semua_sampah)

    return {
        "sampah": {
            "total": total_sampah,
            "belum_diambil": belum_diambil,
            "sudah_diambil": sudah_diambil,
            "total_berat_kg": total_berat,
        },
        "petugas": {
            "total": total_petugas,
            "aktif": petugas_aktif,
        },
        "kendaraan": {
            "total": total_kendaraan,
            "servis": kendaraan_servis,
        },
        "tpa": {
            "total": total_tpa,
        }
    }


# ============================================================
#  ENDPOINT: SAMPAH
# ============================================================

@app.get("/sampah")
def get_semua_sampah(db: Session = Depends(get_db)):
    return db.query(models.Sampah).order_by(models.Sampah.id.desc()).all()


@app.get("/sampah/{id}")
def get_sampah(id: int, db: Session = Depends(get_db)):
    data = db.query(models.Sampah).filter(models.Sampah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    return data


@app.post("/sampah", status_code=201)
def tambah_sampah(body: SampahBuat, db: Session = Depends(get_db)):
    if body.jenis not in ["Organik", "Anorganik", "B3"]:
        raise HTTPException(status_code=400, detail="Jenis harus: Organik / Anorganik / B3")
    if body.berat_kg <= 0:
        raise HTTPException(status_code=400, detail="Berat harus lebih dari 0")

    baru = models.Sampah(
        jenis=body.jenis,
        berat_kg=body.berat_kg,
        lokasi=body.lokasi,
        tingkat_bahaya=set_bahaya(body.jenis),
    )
    db.add(baru)
    db.commit()
    db.refresh(baru)
    return baru


@app.patch("/sampah/{id}/ambil")
def ambil_sampah(id: int, db: Session = Depends(get_db)):
    """Tandai sampah sudah diambil."""
    data = db.query(models.Sampah).filter(models.Sampah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    data.sudah_diambil = True
    db.commit()
    db.refresh(data)
    return {"pesan": f"Sampah #{id} berhasil ditandai sudah diambil", "data": data}


@app.patch("/sampah/{id}/berat")
def update_berat_sampah(id: int, body: SampahUpdateBerat, db: Session = Depends(get_db)):
    """Update berat sampah (timbang ulang)."""
    data = db.query(models.Sampah).filter(models.Sampah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    if body.berat_kg <= 0:
        raise HTTPException(status_code=400, detail="Berat harus lebih dari 0")
    data.berat_kg = body.berat_kg
    db.commit()
    db.refresh(data)
    return {"pesan": f"Berat sampah #{id} diperbarui", "data": data}


@app.delete("/sampah/{id}")
def hapus_sampah(id: int, db: Session = Depends(get_db)):
    data = db.query(models.Sampah).filter(models.Sampah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    db.delete(data)
    db.commit()
    return {"pesan": f"Sampah #{id} berhasil dihapus"}


@app.put("/sampah/{id}")
def edit_sampah(id: int, body: SampahEdit, db: Session = Depends(get_db)):
    """Edit data sampah (jenis, berat, lokasi)."""
    data = db.query(models.Sampah).filter(models.Sampah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    if body.jenis is not None:
        if body.jenis not in ["Organik", "Anorganik", "B3"]:
            raise HTTPException(status_code=400, detail="Jenis harus: Organik / Anorganik / B3")
        data.jenis = body.jenis
        data.tingkat_bahaya = set_bahaya(body.jenis)
    if body.berat_kg is not None:
        if body.berat_kg <= 0:
            raise HTTPException(status_code=400, detail="Berat harus lebih dari 0")
        data.berat_kg = body.berat_kg
    if body.lokasi is not None:
        data.lokasi = body.lokasi
    db.commit()
    db.refresh(data)
    return {"pesan": f"Sampah #{id} berhasil diperbarui", "data": data}


@app.get("/export/sampah")
def export_sampah_csv(db: Session = Depends(get_db)):
    """Export semua data sampah ke CSV."""
    data = db.query(models.Sampah).order_by(models.Sampah.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Jenis", "Berat (kg)", "Lokasi", "Tingkat Bahaya", "Status", "Dibuat Pada"])
    for s in data:
        writer.writerow([
            s.id, s.jenis, s.berat_kg, s.lokasi,
            s.tingkat_bahaya,
            "Sudah Diambil" if s.sudah_diambil else "Belum Diambil",
            s.dibuat_pada.strftime("%d/%m/%Y %H:%M") if s.dibuat_pada else "-"
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=data-sampah.csv"}
    )


@app.get("/export/laporan")
def export_laporan_csv(db: Session = Depends(get_db)):
    """Export semua laporan ke CSV."""
    data = db.query(models.LaporanHarian).order_by(models.LaporanHarian.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Tanggal", "Total Sampah", "Total Berat (kg)", "Jumlah Peringatan"])
    for l in data:
        peringatan = json.loads(l.peringatan) if l.peringatan else []
        writer.writerow([l.id, l.tanggal, l.total_sampah, l.total_berat_kg, len(peringatan)])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=laporan-harian.csv"}
    )


@app.get("/notifikasi")
def get_notifikasi(db: Session = Depends(get_db)):
    """Cek kondisi sistem dan return peringatan aktif."""
    notif = []

    # Cek TPA hampir penuh (>= 80%)
    tpa_list = db.query(models.TPA).all()
    for t in tpa_list:
        if t.kapasitas_ton > 0:
            pct = (t.terisi_ton / t.kapasitas_ton) * 100
            if pct >= 90:
                notif.append({"level": "danger", "pesan": f"TPA '{t.nama}' sudah {pct:.0f}% penuh! Segera kosongkan.", "icon": "fa-industry"})
            elif pct >= 80:
                notif.append({"level": "warning", "pesan": f"TPA '{t.nama}' hampir penuh ({pct:.0f}%).", "icon": "fa-industry"})

    # Cek sampah pending banyak
    belum = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == False).count()
    if belum >= 10:
        notif.append({"level": "danger", "pesan": f"Ada {belum} sampah belum diambil! Segera tindaklanjuti.", "icon": "fa-trash-can"})
    elif belum >= 5:
        notif.append({"level": "warning", "pesan": f"{belum} sampah masih belum diambil.", "icon": "fa-trash-can"})

    # Cek kendaraan servis
    servis = db.query(models.Kendaraan).filter(models.Kendaraan.kondisi == "Servis").count()
    if servis > 0:
        notif.append({"level": "warning", "pesan": f"{servis} kendaraan sedang dalam perbaikan.", "icon": "fa-wrench"})

    # Cek sampah B3
    b3 = db.query(models.Sampah).filter(
        models.Sampah.jenis == "B3",
        models.Sampah.sudah_diambil == False
    ).count()
    if b3 > 0:
        notif.append({"level": "danger", "pesan": f"{b3} sampah B3 berbahaya belum ditangani!", "icon": "fa-radiation"})

    if not notif:
        notif.append({"level": "success", "pesan": "Semua sistem berjalan normal.", "icon": "fa-circle-check"})

    return {"total": len(notif), "items": notif}


@app.get("/statistik")
def get_statistik(db: Session = Depends(get_db)):
    """Data statistik untuk chart di dashboard."""
    # Distribusi jenis sampah
    jenis_data = {}
    semua = db.query(models.Sampah).all()
    for s in semua:
        jenis_data[s.jenis] = jenis_data.get(s.jenis, 0) + 1

    # Status sampah
    sudah = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == True).count()
    belum = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == False).count()

    # Petugas aktif vs nonaktif
    p_aktif    = db.query(models.Petugas).filter(models.Petugas.status_aktif == True).count()
    p_nonaktif = db.query(models.Petugas).filter(models.Petugas.status_aktif == False).count()

    # Top 5 lokasi terbanyak sampah
    from collections import Counter
    lokasi_counter = Counter(s.lokasi for s in semua)
    top_lokasi = lokasi_counter.most_common(5)

    return {
        "jenis": jenis_data,
        "status": {"sudah": sudah, "belum": belum},
        "petugas": {"aktif": p_aktif, "nonaktif": p_nonaktif},
        "top_lokasi": [{"lokasi": l, "jumlah": j} for l, j in top_lokasi],
        "total_berat_per_jenis": {
            j: round(sum(s.berat_kg for s in semua if s.jenis == j), 2)
            for j in ["Organik", "Anorganik", "B3"]
        }
    }


@app.get("/statistik/harian")
def get_statistik_harian(db: Session = Depends(get_db)):
    """Data statistik sampah 7 hari terakhir untuk area chart."""
    from datetime import timedelta
    today = datetime.now().date()
    result = []

    for i in range(6, -1, -1):
        hari = today - timedelta(days=i)
        hari_start = datetime(hari.year, hari.month, hari.day, 0, 0, 0)
        hari_end   = datetime(hari.year, hari.month, hari.day, 23, 59, 59)

        # Sampah yang dibuat pada hari ini
        sampah_hari = db.query(models.Sampah).filter(
            models.Sampah.dibuat_pada >= hari_start,
            models.Sampah.dibuat_pada <= hari_end
        ).all()

        total      = len(sampah_hari)
        diambil    = sum(1 for s in sampah_hari if s.sudah_diambil)
        belum      = total - diambil
        total_berat= round(sum(s.berat_kg for s in sampah_hari), 2)
        b3_count   = sum(1 for s in sampah_hari if s.jenis == "B3")

        # Nama hari Indonesia
        HARI = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"]
        nama_hari = HARI[hari.weekday()]
        tgl_label = f"{nama_hari} {hari.strftime('%d/%m')}"

        result.append({
            "tanggal"    : hari.strftime("%Y-%m-%d"),
            "label"      : tgl_label,
            "nama_hari"  : nama_hari,
            "total"      : total,
            "diambil"    : diambil,
            "belum"      : belum,
            "berat_kg"   : total_berat,
            "b3"         : b3_count,
        })

    # Hitung summary
    total_minggu = sum(r["total"]   for r in result)
    berat_minggu = round(sum(r["berat_kg"] for r in result), 2)
    avg_harian   = round(total_minggu / 7, 1)
    hari_terbanyak = max(result, key=lambda x: x["total"]) if result else {}

    return {
        "hari"          : result,
        "summary"       : {
            "total_minggu"   : total_minggu,
            "berat_minggu"   : berat_minggu,
            "avg_harian"     : avg_harian,
            "hari_terbanyak" : hari_terbanyak.get("label", "-"),
            "max_count"      : hari_terbanyak.get("total", 0),
        }
    }


@app.get("/statistik/realtime")
def get_realtime(db: Session = Depends(get_db)):
    """Data real-time: jumlah sampah hari ini vs kemarin."""
    from datetime import timedelta
    today     = datetime.now().date()
    yesterday = today - timedelta(days=1)

    def count_day(d):
        s = datetime(d.year, d.month, d.day, 0, 0, 0)
        e = datetime(d.year, d.month, d.day, 23, 59, 59)
        rows = db.query(models.Sampah).filter(
            models.Sampah.dibuat_pada >= s,
            models.Sampah.dibuat_pada <= e
        ).all()
        return {
            "total"  : len(rows),
            "diambil": sum(1 for r in rows if r.sudah_diambil),
            "berat"  : round(sum(r.berat_kg for r in rows), 2),
            "b3"     : sum(1 for r in rows if r.jenis == "B3"),
        }

    hari_ini  = count_day(today)
    kemarin   = count_day(yesterday)

    def pct_change(now, prev):
        if prev == 0:
            return 100 if now > 0 else 0
        return round(((now - prev) / prev) * 100, 1)

    return {
        "hari_ini" : hari_ini,
        "kemarin"  : kemarin,
        "perubahan": {
            "total"  : pct_change(hari_ini["total"],   kemarin["total"]),
            "diambil": pct_change(hari_ini["diambil"], kemarin["diambil"]),
            "berat"  : pct_change(hari_ini["berat"],   kemarin["berat"]),
        }
    }


# ============================================================
#  ENDPOINT: TPA
# ============================================================

@app.get("/tpa")
def get_semua_tpa(db: Session = Depends(get_db)):
    return db.query(models.TPA).all()


@app.post("/tpa", status_code=201)
def tambah_tpa(body: TPABuat, db: Session = Depends(get_db)):
    if body.kapasitas_ton <= 0:
        raise HTTPException(status_code=400, detail="Kapasitas harus lebih dari 0")
    baru = models.TPA(nama=body.nama, kapasitas_ton=body.kapasitas_ton)
    db.add(baru)
    db.commit()
    db.refresh(baru)
    return baru


@app.patch("/tpa/{id}/terima/{sampah_id}")
def tpa_terima_sampah(id: int, sampah_id: int, db: Session = Depends(get_db)):
    """TPA menerima sampah – tambah berat ke terisi_ton."""
    tpa    = db.query(models.TPA).filter(models.TPA.id == id).first()
    sampah = db.query(models.Sampah).filter(models.Sampah.id == sampah_id).first()
    if not tpa:
        raise HTTPException(status_code=404, detail="TPA tidak ditemukan")
    if not sampah:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")

    berat_ton = sampah.berat_kg / 1000
    if tpa.terisi_ton + berat_ton > tpa.kapasitas_ton:
        raise HTTPException(status_code=400, detail="TPA sudah penuh!")

    tpa.terisi_ton += berat_ton
    db.commit()
    db.refresh(tpa)
    return {"pesan": f"Sampah #{sampah_id} diterima di TPA '{tpa.nama}'", "tpa": tpa}


@app.patch("/tpa/{id}/kosongkan")
def kosongkan_tpa(id: int, db: Session = Depends(get_db)):
    """Reset isi TPA jadi 0."""
    tpa = db.query(models.TPA).filter(models.TPA.id == id).first()
    if not tpa:
        raise HTTPException(status_code=404, detail="TPA tidak ditemukan")
    tpa.terisi_ton = 0.0
    tpa.tgl_terakhir_dikosongkan = datetime.now().strftime("%d %B %Y")
    db.commit()
    db.refresh(tpa)
    return {"pesan": f"TPA '{tpa.nama}' berhasil dikosongkan", "tpa": tpa}


@app.delete("/tpa/{id}")
def hapus_tpa(id: int, db: Session = Depends(get_db)):
    tpa = db.query(models.TPA).filter(models.TPA.id == id).first()
    if not tpa:
        raise HTTPException(status_code=404, detail="TPA tidak ditemukan")
    db.delete(tpa)
    db.commit()
    return {"pesan": f"TPA #{id} berhasil dihapus"}


# ============================================================
#  ENDPOINT: PETUGAS
# ============================================================

@app.get("/petugas")
def get_semua_petugas(db: Session = Depends(get_db)):
    return db.query(models.Petugas).all()


@app.post("/petugas", status_code=201)
def tambah_petugas(body: PetugasBuat, db: Session = Depends(get_db)):
    baru = models.Petugas(nama=body.nama, zona_tugas=body.zona_tugas)
    db.add(baru)
    db.commit()
    db.refresh(baru)
    return baru


@app.patch("/petugas/{id}/nonaktifkan")
def nonaktifkan_petugas(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Petugas).filter(models.Petugas.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Petugas tidak ditemukan")
    p.status_aktif = False
    db.commit()
    db.refresh(p)
    return {"pesan": f"Petugas {p.nama} dinonaktifkan", "data": p}


@app.patch("/petugas/{id}/aktifkan")
def aktifkan_petugas(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Petugas).filter(models.Petugas.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Petugas tidak ditemukan")
    p.status_aktif = True
    db.commit()
    db.refresh(p)
    return {"pesan": f"Petugas {p.nama} diaktifkan kembali", "data": p}


class PetugasEdit(BaseModel):
    nama: Optional[str] = None
    zona_tugas: Optional[str] = None


@app.patch("/petugas/{id}/edit")
def edit_petugas(id: int, body: PetugasEdit, db: Session = Depends(get_db)):
    """Edit nama dan zona tugas petugas."""
    p = db.query(models.Petugas).filter(models.Petugas.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Petugas tidak ditemukan")
    if body.nama:
        p.nama = body.nama
    if body.zona_tugas:
        p.zona_tugas = body.zona_tugas
    db.commit()
    db.refresh(p)
    return {"pesan": f"Data petugas {p.nama} berhasil diperbarui", "data": p}


@app.patch("/petugas/{id}/kumpulkan/{sampah_id}")
def petugas_kumpulkan(id: int, sampah_id: int, db: Session = Depends(get_db)):
    """Petugas mengambil sampah – update counter & status sampah."""
    p      = db.query(models.Petugas).filter(models.Petugas.id == id).first()
    sampah = db.query(models.Sampah).filter(models.Sampah.id == sampah_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Petugas tidak ditemukan")
    if not sampah:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    if not p.status_aktif:
        raise HTTPException(status_code=400, detail=f"Petugas {p.nama} sedang tidak aktif")
    if sampah.sudah_diambil:
        raise HTTPException(status_code=400, detail="Sampah sudah diambil sebelumnya")

    sampah.sudah_diambil = True
    p.total_ambil += 1
    db.commit()
    return {"pesan": f"Petugas {p.nama} berhasil mengambil sampah #{sampah_id}"}


@app.delete("/petugas/{id}")
def hapus_petugas(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Petugas).filter(models.Petugas.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Petugas tidak ditemukan")
    db.delete(p)
    db.commit()
    return {"pesan": f"Petugas #{id} berhasil dihapus"}


# ============================================================
#  ENDPOINT: KENDARAAN
# ============================================================

@app.get("/kendaraan")
def get_semua_kendaraan(db: Session = Depends(get_db)):
    return db.query(models.Kendaraan).all()


@app.post("/kendaraan", status_code=201)
def tambah_kendaraan(body: KendaraanBuat, db: Session = Depends(get_db)):
    cek = db.query(models.Kendaraan).filter(models.Kendaraan.plat_nomor == body.plat_nomor).first()
    if cek:
        raise HTTPException(status_code=400, detail="Plat nomor sudah terdaftar")
    baru = models.Kendaraan(plat_nomor=body.plat_nomor, kapasitas_kg=body.kapasitas_kg)
    db.add(baru)
    db.commit()
    db.refresh(baru)
    return baru


@app.patch("/kendaraan/{id}/muat/{sampah_id}")
def kendaraan_muat(id: int, sampah_id: int, db: Session = Depends(get_db)):
    k      = db.query(models.Kendaraan).filter(models.Kendaraan.id == id).first()
    sampah = db.query(models.Sampah).filter(models.Sampah.id == sampah_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kendaraan tidak ditemukan")
    if not sampah:
        raise HTTPException(status_code=404, detail="Sampah tidak ditemukan")
    if k.kondisi == "Servis":
        raise HTTPException(status_code=400, detail=f"Kendaraan {k.plat_nomor} sedang servis")
    if k.muatan_kg + sampah.berat_kg > k.kapasitas_kg:
        raise HTTPException(status_code=400, detail="Kendaraan sudah penuh!")

    k.muatan_kg += sampah.berat_kg
    rute_list = [r for r in k.rute.split(",") if r] if k.rute else []
    if sampah.lokasi not in rute_list:
        rute_list.append(sampah.lokasi)
    k.rute = ",".join(rute_list)
    db.commit()
    db.refresh(k)
    return {"pesan": f"Sampah #{sampah_id} dimuat ke kendaraan {k.plat_nomor}", "kendaraan": k}


@app.patch("/kendaraan/{id}/bongkar")
def kendaraan_bongkar(id: int, db: Session = Depends(get_db)):
    """Bongkar muatan kendaraan setelah sampai TPA."""
    k = db.query(models.Kendaraan).filter(models.Kendaraan.id == id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kendaraan tidak ditemukan")
    k.muatan_kg = 0.0
    k.rute      = ""
    k.kondisi   = "Baik"
    db.commit()
    db.refresh(k)
    return {"pesan": f"Kendaraan {k.plat_nomor} berhasil dibongkar muatannya", "kendaraan": k}


@app.patch("/kendaraan/{id}/servis")
def kendaraan_servis(id: int, db: Session = Depends(get_db)):
    k = db.query(models.Kendaraan).filter(models.Kendaraan.id == id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kendaraan tidak ditemukan")
    k.kondisi = "Servis"
    db.commit()
    db.refresh(k)
    return {"pesan": f"Kendaraan {k.plat_nomor} dikirim ke servis", "kendaraan": k}


@app.delete("/kendaraan/{id}")
def hapus_kendaraan(id: int, db: Session = Depends(get_db)):
    k = db.query(models.Kendaraan).filter(models.Kendaraan.id == id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kendaraan tidak ditemukan")
    db.delete(k)
    db.commit()
    return {"pesan": f"Kendaraan #{id} berhasil dihapus"}


# ============================================================
#  ENDPOINT: LAPORAN HARIAN
# ============================================================

@app.get("/laporan")
def get_semua_laporan(db: Session = Depends(get_db)):
    return db.query(models.LaporanHarian).order_by(models.LaporanHarian.id.desc()).all()


@app.post("/laporan", status_code=201)
def buat_laporan(body: LaporanBuat, db: Session = Depends(get_db)):
    """Buat laporan harian – otomatis hitung dari data sampah hari itu."""
    semua_sampah = db.query(models.Sampah).filter(models.Sampah.sudah_diambil == True).all()

    catatan    = []
    peringatan = []
    total_berat = 0.0

    for s in semua_sampah:
        total_berat += s.berat_kg
        catatan.append(f"Sampah #{s.id} ({s.jenis}) dari {s.lokasi}")
        if s.jenis == "B3":
            peringatan.append(f"Sampah B3 #{s.id} dari {s.lokasi} – perlu penanganan khusus!")

    laporan = models.LaporanHarian(
        tanggal=body.tanggal,
        total_sampah=len(semua_sampah),
        total_berat_kg=total_berat,
        catatan=json.dumps(catatan),
        peringatan=json.dumps(peringatan),
    )
    db.add(laporan)
    db.commit()
    db.refresh(laporan)

    return {
        "id": laporan.id,
        "tanggal": laporan.tanggal,
        "total_sampah": laporan.total_sampah,
        "total_berat_kg": laporan.total_berat_kg,
        "catatan": catatan,
        "peringatan": peringatan,
    }


@app.patch("/laporan/{id}/peringatan")
def tambah_peringatan(id: int, body: PeringatanTambah, db: Session = Depends(get_db)):
    lap = db.query(models.LaporanHarian).filter(models.LaporanHarian.id == id).first()
    if not lap:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    peringatan = json.loads(lap.peringatan) if lap.peringatan else []
    peringatan.append(body.pesan)
    lap.peringatan = json.dumps(peringatan)
    db.commit()
    db.refresh(lap)
    return {"pesan": "Peringatan ditambahkan", "peringatan": peringatan}


@app.get("/laporan/{id}")
def get_laporan(id: int, db: Session = Depends(get_db)):
    lap = db.query(models.LaporanHarian).filter(models.LaporanHarian.id == id).first()
    if not lap:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return {
        "id": lap.id,
        "tanggal": lap.tanggal,
        "total_sampah": lap.total_sampah,
        "total_berat_kg": lap.total_berat_kg,
        "catatan": json.loads(lap.catatan) if lap.catatan else [],
        "peringatan": json.loads(lap.peringatan) if lap.peringatan else [],
        "dibuat_pada": lap.dibuat_pada,
    }


@app.delete("/laporan/{id}")
def hapus_laporan(id: int, db: Session = Depends(get_db)):
    lap = db.query(models.LaporanHarian).filter(models.LaporanHarian.id == id).first()
    if not lap:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    db.delete(lap)
    db.commit()
    return {"pesan": f"Laporan #{id} berhasil dihapus"}
