# SmartWaste v2.0

Dashboard pengelolaan sampah dengan frontend HTML/CSS/JavaScript dan backend FastAPI.

## Menjalankan secara lokal

1. Pasang dependensi backend:

   ```powershell
   py -m pip install -r backend/requirements.txt
   ```

2. Jalankan backend di port `8090`:

   ```powershell
   py -m uvicorn main:app --reload --host 127.0.0.1 --port 8090 --app-dir backend
   ```

   Di Windows, kamu juga bisa menjalankan `start-backend.bat`.

3. Buka terminal lain dan sajikan frontend:

   ```powershell
   py -m http.server 8080 --directory frontend
   ```

4. Buka `http://localhost:8080`.

Frontend lokal otomatis memakai backend `http://localhost:8090`. Pada hosting, isi nilai `content` di tag `meta[name="smartwaste-api-url"]` pada `frontend/index.html` dengan alamat backend yang dipakai. Jika backend tersedia pada origin yang sama dengan frontend, biarkan nilainya kosong.

## Struktur

- `frontend/` — halaman dashboard dan aset browser
- `backend/` — API FastAPI dan database SQLite
- `start-backend.bat` — pintasan untuk menjalankan API dari folder repositori
