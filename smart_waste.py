# ============================================================
#   PROJECT: SMART WASTE MANAGEMENT SYSTEM
#   Bahasa : Python
#   Isi    : 5 Class, 5+ Atribut, 5+ Method, 5+ Object
# ============================================================


# ─────────────────────────────────────────
# CLASS 1: Sampah (merepresentasikan satu item sampah)
# ─────────────────────────────────────────
class Sampah:
    def __init__(self, id_sampah, jenis, berat_kg, lokasi, sudah_diambil=False):
        self.id_sampah    = id_sampah       # Atribut 1
        self.jenis        = jenis           # Atribut 2  (organik / anorganik / B3)
        self.berat_kg     = berat_kg        # Atribut 3
        self.lokasi       = lokasi          # Atribut 4
        self.sudah_diambil = sudah_diambil  # Atribut 5

    # Method 1 – tampilkan info sampah
    def info(self):
        status = "Sudah diambil" if self.sudah_diambil else "Belum diambil"
        print(f"[Sampah #{self.id_sampah}] Jenis: {self.jenis} | "
              f"Berat: {self.berat_kg} kg | Lokasi: {self.lokasi} | Status: {status}")

    # Method 2 – tandai sampah sudah diambil
    def ambil(self):
        self.sudah_diambil = True
        print(f"  -> Sampah #{self.id_sampah} di {self.lokasi} berhasil diambil.")


# ─────────────────────────────────────────
# CLASS 2: TempaPembuangan (TPA / tempat akhir)
# ─────────────────────────────────────────
class TempaPembuangan:
    def __init__(self, nama, kapasitas_ton):
        self.nama          = nama            # Atribut 1
        self.kapasitas_ton = kapasitas_ton   # Atribut 2
        self.terisi_ton    = 0               # Atribut 3
        self.daftar_sampah = []              # Atribut 4

    # Method 3 – terima sampah ke TPA
    def terima_sampah(self, sampah: Sampah):
        berat_ton = sampah.berat_kg / 1000
        if self.terisi_ton + berat_ton > self.kapasitas_ton:
            print(f"  [!] TPA '{self.nama}' sudah penuh! Tidak bisa menerima sampah.")
        else:
            self.daftar_sampah.append(sampah)
            self.terisi_ton += berat_ton
            print(f"  -> Sampah #{sampah.id_sampah} diterima di TPA '{self.nama}'.")

    # Method 4 – cek kapasitas tersisa
    def cek_kapasitas(self):
        sisa = self.kapasitas_ton - self.terisi_ton
        print(f"  TPA '{self.nama}': {self.terisi_ton:.3f} ton terisi, "
              f"sisa kapasitas {sisa:.3f} ton.")


# ─────────────────────────────────────────
# CLASS 3: Petugas (pekerja pengangkut sampah)
# ─────────────────────────────────────────
class Petugas:
    def __init__(self, id_petugas, nama, zona_tugas):
        self.id_petugas  = id_petugas   # Atribut 1
        self.nama        = nama          # Atribut 2
        self.zona_tugas  = zona_tugas    # Atribut 3
        self.total_ambil = 0             # Atribut 4 – jumlah sampah yang sudah diambil

    # Method 5 – petugas mengambil sampah
    def kumpulkan(self, sampah: Sampah, tpa: TempaPembuangan):
        print(f"\n[Petugas] {self.nama} mengambil sampah di {sampah.lokasi}...")
        sampah.ambil()
        tpa.terima_sampah(sampah)
        self.total_ambil += 1

    # Method 6 – laporan kerja petugas
    def laporan(self):
        print(f"  Petugas {self.nama} (Zona: {self.zona_tugas}) "
              f"sudah mengambil {self.total_ambil} item sampah.")


# ─────────────────────────────────────────
# CLASS 4: Kendaraan (truk pengangkut)
# ─────────────────────────────────────────
class Kendaraan:
    def __init__(self, plat_nomor, kapasitas_kg):
        self.plat_nomor   = plat_nomor    # Atribut 1
        self.kapasitas_kg = kapasitas_kg  # Atribut 2
        self.muatan_kg    = 0             # Atribut 3
        self.rute         = []            # Atribut 4 – daftar lokasi yang dikunjungi

    # Method 7 – muat sampah ke kendaraan
    def muat(self, sampah: Sampah):
        if self.muatan_kg + sampah.berat_kg > self.kapasitas_kg:
            print(f"  [!] Kendaraan {self.plat_nomor} sudah penuh!")
        else:
            self.muatan_kg += sampah.berat_kg
            if sampah.lokasi not in self.rute:
                self.rute.append(sampah.lokasi)
            print(f"  -> Dimuat ke kendaraan {self.plat_nomor}. "
                  f"Muatan sekarang: {self.muatan_kg} kg.")

    # Method 8 – info kendaraan
    def info_kendaraan(self):
        print(f"  Kendaraan {self.plat_nomor} | Kapasitas: {self.kapasitas_kg} kg | "
              f"Muatan: {self.muatan_kg} kg | Rute: {', '.join(self.rute) if self.rute else '-'}")


# ─────────────────────────────────────────
# CLASS 5: LaporanHarian (rekap di akhir hari)
# ─────────────────────────────────────────
class LaporanHarian:
    def __init__(self, tanggal):
        self.tanggal        = tanggal   # Atribut 1
        self.total_sampah   = 0         # Atribut 2
        self.total_berat_kg = 0         # Atribut 3
        self.catatan        = []        # Atribut 4

    # Method 9 – catat sampah ke laporan
    def catat(self, sampah: Sampah):
        if sampah.sudah_diambil:
            self.total_sampah   += 1
            self.total_berat_kg += sampah.berat_kg
            self.catatan.append(f"Sampah #{sampah.id_sampah} ({sampah.jenis}) "
                                 f"dari {sampah.lokasi}")

    # Method 10 – tampilkan laporan lengkap
    def tampilkan(self):
        print(f"\n{'='*50}")
        print(f"  LAPORAN HARIAN - {self.tanggal}")
        print(f"{'='*50}")
        print(f"  Total item diambil : {self.total_sampah}")
        print(f"  Total berat        : {self.total_berat_kg} kg")
        print(f"  Detail:")
        for c in self.catatan:
            print(f"    - {c}")
        print(f"{'='*50}\n")


# ============================================================
#   MAIN PROGRAM – membuat 5+ object dan jalankan semuanya
# ============================================================
if __name__ == "__main__":

    print("=" * 50)
    print("   SMART WASTE MANAGEMENT SYSTEM")
    print("=" * 50)

    # --- 5 Object Sampah ---
    s1 = Sampah(1, "Organik",    2.5,  "Jl. Merdeka No.1")
    s2 = Sampah(2, "Anorganik",  1.2,  "Jl. Sudirman No.5")
    s3 = Sampah(3, "B3",         0.8,  "Jl. Gatot Subroto")
    s4 = Sampah(4, "Organik",    3.0,  "Jl. Diponegoro No.3")
    s5 = Sampah(5, "Anorganik",  0.5,  "Jl. Pahlawan No.10")

    print("\n[INFO] Daftar sampah yang perlu diambil:")
    for s in [s1, s2, s3, s4, s5]:
        s.info()

    # --- Object TPA ---
    tpa_utama = TempaPembuangan("TPA Bantar Gebang", kapasitas_ton=500)

    # --- Object Kendaraan ---
    truk1 = Kendaraan("B 1234 AB", kapasitas_kg=5000)

    # --- 2 Object Petugas ---
    petugas1 = Petugas(101, "Budi",  "Zona A")
    petugas2 = Petugas(102, "Siti",  "Zona B")

    # --- Object Laporan ---
    laporan = LaporanHarian("14 Agustus 2026")

    # --- Simulasi pengambilan sampah ---
    print("\n[PROSES] Pengambilan sampah dimulai...\n")

    petugas1.kumpulkan(s1, tpa_utama)
    truk1.muat(s1)

    petugas1.kumpulkan(s2, tpa_utama)
    truk1.muat(s2)

    petugas2.kumpulkan(s3, tpa_utama)
    truk1.muat(s3)

    petugas2.kumpulkan(s4, tpa_utama)
    truk1.muat(s4)

    petugas1.kumpulkan(s5, tpa_utama)
    truk1.muat(s5)

    # --- Cek kapasitas TPA & kendaraan ---
    print("\n[STATUS]")
    tpa_utama.cek_kapasitas()
    truk1.info_kendaraan()

    # --- Laporan petugas ---
    print("\n[LAPORAN PETUGAS]")
    petugas1.laporan()
    petugas2.laporan()

    # --- Catat semua ke laporan harian ---
    for s in [s1, s2, s3, s4, s5]:
        laporan.catat(s)

    laporan.tampilkan()
