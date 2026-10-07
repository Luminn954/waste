# SmartWaste v2.0

Dashboard pengelolaan sampah dengan frontend HTML/CSS/JavaScript dan backend PHP. API PHP membaca database SQLite yang sama di `backend/smart_waste.db`, sehingga data yang tersimpan sebelumnya tetap dipakai.

## Menjalankan secara lokal

Persyaratan: PHP 8.1+ dengan ekstensi `pdo_sqlite`. XAMPP sudah menyertakan PHP; pastikan ekstensi `pdo_sqlite` aktif.

Di Windows, jalankan `start-backend.bat`, lalu buka [http://127.0.0.1:8090](http://127.0.0.1:8090). Server PHP menyajikan tampilan frontend dan API dari satu alamat.

Atau jalankan manual dari folder repositori:

```powershell
php -S 127.0.0.1:8090 router.php
```

## Hosting

Hosting harus mendukung PHP 8.1+, `pdo_sqlite`, dan penulisan ke folder `backend/` agar database SQLite dapat digunakan. GitHub Pages hanya menyajikan file statis, jadi backend PHP perlu ditempatkan di hosting PHP. Jika frontend dan API berada di origin yang sama, biarkan `meta[name="smartwaste-api-url"]` kosong di `frontend/index.html`. Jika API ada di host berbeda, isi `content` pada meta tersebut dengan URL backend.

## Struktur

- `frontend/` — dashboard SmartWaste v2.0 dan aset browser
- `backend/index.php` — endpoint API PHP untuk sampah, petugas, kendaraan, TPA, laporan, dan statistik
- `backend/smart_waste.db` — database SQLite bersama yang menyimpan data aplikasi
- `router.php` — melayani frontend dan meneruskan endpoint API ke PHP
- `start-backend.bat` — menjalankan aplikasi lokal melalui PHP
