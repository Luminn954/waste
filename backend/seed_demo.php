<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

date_default_timezone_set('Asia/Jakarta');
require_once __DIR__ . DIRECTORY_SEPARATOR . 'database.php';

$pdo = database();
$today = new DateTimeImmutable('today');
$dateFor = static function (int $daysAgo, string $time) use ($today): string {
    return $today->modify('-' . $daysAgo . ' days')->format('Y-m-d') . ' ' . $time;
};

$trash = [
    ['Organik', 12.5, 'Kantin Utama', 6, '08:15:00', 1],
    ['Anorganik', 5.2, 'Gedung A - Lantai 1', 6, '09:20:00', 1],
    ['B3', 1.4, 'Laboratorium IPA', 5, '10:05:00', 1],
    ['Organik', 8.0, 'Taman Sekolah', 5, '11:30:00', 0],
    ['Anorganik', 3.6, 'Lapangan Sekolah', 4, '08:45:00', 1],
    ['Organik', 15.0, 'Kantin Utama', 4, '12:10:00', 1],
    ['B3', 0.8, 'Laboratorium Komputer', 3, '09:10:00', 0],
    ['Anorganik', 6.5, 'Gedung B - Lantai 2', 3, '14:30:00', 1],
    ['Organik', 9.4, 'Taman Sekolah', 2, '08:20:00', 0],
    ['Anorganik', 4.1, 'Kantor Guru', 1, '10:00:00', 1],
    ['Organik', 11.2, 'Kantin Utama', 0, '07:40:00', 1],
    ['B3', 0.6, 'Laboratorium IPA', 0, '09:15:00', 0],
];

$crew = [
    ['Siti Rahma', 'Zona Utara', 12, 1],
    ['Doni Pratama', 'Zona Tengah', 9, 1],
    ['Maya Putri', 'Zona Selatan', 7, 1],
    ['Agus Saputra', 'Zona Barat', 4, 0],
];

$vehicles = [
    ['B 9123 WST', 900.0, 125.0, 'Baik', 'Kantin Utama,Taman Sekolah'],
    ['B 8045 WST', 1200.0, 45.0, 'Baik', 'Gedung A - Lantai 1,Kantor Guru'],
    ['B 6732 WST', 700.0, 0.0, 'Servis', ''],
];

$landfills = [
    ['TPA Terpadu Cipayung', 12.0, 7.4, '15 September 2026'],
    ['TPA Unit Barat', 8.0, 3.1, '28 September 2026'],
];

$reports = [
    [-5, 1, 1.4, ['Sampah B3 dari Laboratorium IPA ditangani petugas'], ['Gunakan wadah khusus untuk sampah B3']],
    [-2, 3, 24.4, ['Sampah organik dan anorganik dari area sekolah sudah direkap'], []],
    [0, 2, 11.8, ['Sampah dari Kantin Utama dan Laboratorium IPA tercatat hari ini'], ['Pastikan sampah B3 di Laboratorium IPA segera ditangani']],
];

try {
    $pdo->beginTransaction();
    foreach (['laporan_harian', 'kendaraan', 'petugas', 'tpa', 'sampah'] as $table) {
        $pdo->exec('DELETE FROM ' . $table);
    }

    $insertTrash = $pdo->prepare('INSERT INTO sampah (jenis, berat_kg, lokasi, tingkat_bahaya, sudah_diambil, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($trash as [$kind, $weight, $location, $daysAgo, $time, $collected]) {
        $hazard = $kind === 'B3' ? 'TINGGI' : ($kind === 'Anorganik' ? 'SEDANG' : 'RENDAH');
        $insertTrash->execute([$kind, $weight, $location, $hazard, $collected, $dateFor($daysAgo, $time)]);
    }

    $insertCrew = $pdo->prepare('INSERT INTO petugas (nama, zona_tugas, total_ambil, status_aktif) VALUES (?, ?, ?, ?)');
    foreach ($crew as $row) {
        $insertCrew->execute($row);
    }

    $insertVehicle = $pdo->prepare('INSERT INTO kendaraan (plat_nomor, kapasitas_kg, muatan_kg, kondisi, rute) VALUES (?, ?, ?, ?, ?)');
    foreach ($vehicles as $row) {
        $insertVehicle->execute($row);
    }

    $insertLandfill = $pdo->prepare('INSERT INTO tpa (nama, kapasitas_ton, terisi_ton, tgl_terakhir_dikosongkan) VALUES (?, ?, ?, ?)');
    foreach ($landfills as $row) {
        $insertLandfill->execute($row);
    }

    $insertReport = $pdo->prepare('INSERT INTO laporan_harian (tanggal, total_sampah, total_berat_kg, catatan, peringatan, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($reports as [$daysAgo, $total, $weight, $notes, $warnings]) {
        $reportDate = $today->modify('-' . $daysAgo . ' days');
        $insertReport->execute([
            $reportDate->format('Y-m-d'),
            $total,
            $weight,
            json_encode($notes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode($warnings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $reportDate->format('Y-m-d') . ' 17:00:00',
        ]);
    }

    $pdo->commit();
    echo "Dataset demo baru berhasil dibuat: 12 sampah, 4 petugas, 3 kendaraan, 2 TPA, 3 laporan.\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Gagal membuat dataset demo: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
