<?php
declare(strict_types=1);

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $connection = new PDO('sqlite:' . __DIR__ . DIRECTORY_SEPARATOR . 'smart_waste.db', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $connection->exec('PRAGMA foreign_keys = ON');
    $connection->exec('PRAGMA busy_timeout = 5000');

    $connection->exec('CREATE TABLE IF NOT EXISTS sampah (
        id INTEGER PRIMARY KEY,
        jenis VARCHAR(50) NOT NULL,
        berat_kg FLOAT NOT NULL,
        lokasi VARCHAR(200) NOT NULL,
        tingkat_bahaya VARCHAR(20) NOT NULL,
        sudah_diambil BOOLEAN DEFAULT 0,
        dibuat_pada DATETIME
    )');
    $connection->exec('CREATE TABLE IF NOT EXISTS tpa (
        id INTEGER PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        kapasitas_ton FLOAT NOT NULL,
        terisi_ton FLOAT DEFAULT 0,
        tgl_terakhir_dikosongkan VARCHAR(50) DEFAULT \'-\'
    )');
    $connection->exec('CREATE TABLE IF NOT EXISTS petugas (
        id INTEGER PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        zona_tugas VARCHAR(100) NOT NULL,
        total_ambil INTEGER DEFAULT 0,
        status_aktif BOOLEAN DEFAULT 1
    )');
    $connection->exec('CREATE TABLE IF NOT EXISTS kendaraan (
        id INTEGER PRIMARY KEY,
        plat_nomor VARCHAR(20) NOT NULL UNIQUE,
        kapasitas_kg FLOAT NOT NULL,
        muatan_kg FLOAT DEFAULT 0,
        kondisi VARCHAR(20) DEFAULT \'Baik\',
        rute TEXT DEFAULT \'\'
    )');
    $connection->exec('CREATE TABLE IF NOT EXISTS laporan_harian (
        id INTEGER PRIMARY KEY,
        tanggal VARCHAR(50) NOT NULL,
        total_sampah INTEGER DEFAULT 0,
        total_berat_kg FLOAT DEFAULT 0,
        catatan TEXT DEFAULT \'\',
        peringatan TEXT DEFAULT \'\',
        dibuat_pada DATETIME
    )');

    return $connection;
}
