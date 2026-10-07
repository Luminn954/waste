<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Jakarta');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . DIRECTORY_SEPARATOR . 'database.php';

function send_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message): void
{
    send_json(['detail' => $message], $status);
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(400, 'Body harus berupa JSON object yang valid');
    }
    return $data;
}

function required_text(array $body, string $key): string
{
    if (!array_key_exists($key, $body) || !is_string($body[$key])) {
        fail(400, "Field {$key} wajib berupa teks");
    }
    return $body[$key];
}

function required_number(array $body, string $key): float
{
    if (!array_key_exists($key, $body) || !is_numeric($body[$key]) || !is_finite((float) $body[$key])) {
        fail(400, "Field {$key} wajib berupa angka");
    }
    return (float) $body[$key];
}

function row_by_id(PDO $pdo, string $table, int $id): ?array
{
    $statement = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
    $statement->execute([$id]);
    $row = $statement->fetch();
    return $row === false ? null : $row;
}

function require_row(PDO $pdo, string $table, int $id, string $label): array
{
    $row = row_by_id($pdo, $table, $id);
    if ($row === null) {
        fail(404, "{$label} tidak ditemukan");
    }
    return $row;
}

function sampah_data(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['berat_kg'] = (float) $row['berat_kg'];
    $row['sudah_diambil'] = (bool) $row['sudah_diambil'];
    return $row;
}

function petugas_data(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['total_ambil'] = (int) $row['total_ambil'];
    $row['status_aktif'] = (bool) $row['status_aktif'];
    return $row;
}

function kendaraan_data(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['kapasitas_kg'] = (float) $row['kapasitas_kg'];
    $row['muatan_kg'] = (float) $row['muatan_kg'];
    return $row;
}

function tpa_data(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['kapasitas_ton'] = (float) $row['kapasitas_ton'];
    $row['terisi_ton'] = (float) $row['terisi_ton'];
    return $row;
}

function laporan_data(array $row, bool $decodeLists = false): array
{
    $row['id'] = (int) $row['id'];
    $row['total_sampah'] = (int) $row['total_sampah'];
    $row['total_berat_kg'] = (float) $row['total_berat_kg'];
    if ($decodeLists) {
        $row['catatan'] = json_list($row['catatan']);
        $row['peringatan'] = json_list($row['peringatan']);
    }
    return $row;
}

function json_list($value): array
{
    if (!is_string($value) || $value === '') {
        return [];
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function hazard_for(string $kind): string
{
    if ($kind === 'B3') {
        return 'TINGGI';
    }
    if ($kind === 'Anorganik') {
        return 'SEDANG';
    }
    return 'RENDAH';
}

function send_csv(string $filename, array $columns, array $rows): void
{
    http_response_code(200);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $stream = fopen('php://temp', 'r+');
    fputcsv($stream, $columns, ',', '"', '');
    foreach ($rows as $row) {
        fputcsv($stream, $row, ',', '"', '');
    }
    rewind($stream);
    fpassthru($stream);
    fclose($stream);
    exit;
}

function count_for_day(PDO $pdo, string $date): array
{
    $statement = $pdo->prepare('SELECT jenis, berat_kg, sudah_diambil FROM sampah WHERE dibuat_pada >= ? AND dibuat_pada <= ?');
    $statement->execute([$date . ' 00:00:00', $date . ' 23:59:59']);
    $rows = $statement->fetchAll();
    $taken = 0;
    $weight = 0.0;
    $b3 = 0;
    foreach ($rows as $row) {
        if ((bool) $row['sudah_diambil']) {
            $taken++;
        }
        $weight += (float) $row['berat_kg'];
        if ($row['jenis'] === 'B3') {
            $b3++;
        }
    }
    return [
        'total' => count($rows),
        'diambil' => $taken,
        'berat' => round($weight, 2),
        'b3' => $b3,
    ];
}

function percent_change(float $current, float $previous)
{
    if ($previous == 0.0) {
        return $current > 0 ? 100 : 0;
    }
    return round((($current - $previous) / $previous) * 100, 1);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim(rawurldecode($path), '/');
if ($path === '//') {
    $path = '/';
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET' && $path === '/health') {
    send_json(['pesan' => 'Smart Waste PHP API berjalan!']);
}

try {
    $pdo = database();

    if ($method === 'GET' && $path === '/dashboard') {
        $sampah = $pdo->query('SELECT COUNT(*) AS total,
            SUM(CASE WHEN sudah_diambil = 0 THEN 1 ELSE 0 END) AS belum_diambil,
            SUM(CASE WHEN sudah_diambil = 1 THEN 1 ELSE 0 END) AS sudah_diambil,
            COALESCE(SUM(CASE WHEN sudah_diambil = 1 THEN berat_kg ELSE 0 END), 0) AS total_berat_kg
            FROM sampah')->fetch();
        $petugas = $pdo->query('SELECT COUNT(*) AS total, SUM(CASE WHEN status_aktif = 1 THEN 1 ELSE 0 END) AS aktif FROM petugas')->fetch();
        $kendaraan = $pdo->query('SELECT COUNT(*) AS total, SUM(CASE WHEN kondisi = \'Servis\' THEN 1 ELSE 0 END) AS servis FROM kendaraan')->fetch();
        $tpa = $pdo->query('SELECT COUNT(*) AS total FROM tpa')->fetch();
        send_json([
            'sampah' => [
                'total' => (int) $sampah['total'],
                'belum_diambil' => (int) $sampah['belum_diambil'],
                'sudah_diambil' => (int) $sampah['sudah_diambil'],
                'total_berat_kg' => (float) $sampah['total_berat_kg'],
            ],
            'petugas' => ['total' => (int) $petugas['total'], 'aktif' => (int) $petugas['aktif']],
            'kendaraan' => ['total' => (int) $kendaraan['total'], 'servis' => (int) $kendaraan['servis']],
            'tpa' => ['total' => (int) $tpa['total']],
        ]);
    }

    if ($method === 'GET' && $path === '/sampah') {
        $rows = $pdo->query('SELECT * FROM sampah ORDER BY id DESC')->fetchAll();
        send_json(array_map('sampah_data', $rows));
    }
    if (preg_match('#^/sampah/(\d+)/ambil$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        require_row($pdo, 'sampah', $id, 'Sampah');
        $statement = $pdo->prepare('UPDATE sampah SET sudah_diambil = 1 WHERE id = ?');
        $statement->execute([$id]);
        send_json(['pesan' => "Sampah #{$id} berhasil ditandai sudah diambil", 'data' => sampah_data(row_by_id($pdo, 'sampah', $id))]);
    }
    if (preg_match('#^/sampah/(\d+)/berat$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        require_row($pdo, 'sampah', $id, 'Sampah');
        $weight = required_number(json_body(), 'berat_kg');
        if ($weight <= 0) {
            fail(400, 'Berat harus lebih dari 0');
        }
        $statement = $pdo->prepare('UPDATE sampah SET berat_kg = ? WHERE id = ?');
        $statement->execute([$weight, $id]);
        send_json(['pesan' => "Berat sampah #{$id} diperbarui", 'data' => sampah_data(row_by_id($pdo, 'sampah', $id))]);
    }
    if (preg_match('#^/sampah/(\d+)$#', $path, $match)) {
        $id = (int) $match[1];
        if ($method === 'GET') {
            send_json(sampah_data(require_row($pdo, 'sampah', $id, 'Sampah')));
        }
        if ($method === 'DELETE') {
            require_row($pdo, 'sampah', $id, 'Sampah');
            $statement = $pdo->prepare('DELETE FROM sampah WHERE id = ?');
            $statement->execute([$id]);
            send_json(['pesan' => "Sampah #{$id} berhasil dihapus"]);
        }
        if ($method === 'PUT') {
            $current = require_row($pdo, 'sampah', $id, 'Sampah');
            $body = json_body();
            $sets = [];
            $values = [];
            if (array_key_exists('jenis', $body) && $body['jenis'] !== null) {
                if (!in_array($body['jenis'], ['Organik', 'Anorganik', 'B3'], true)) {
                    fail(400, 'Jenis harus: Organik / Anorganik / B3');
                }
                $sets[] = 'jenis = ?';
                $values[] = $body['jenis'];
                $sets[] = 'tingkat_bahaya = ?';
                $values[] = hazard_for($body['jenis']);
            }
            if (array_key_exists('berat_kg', $body) && $body['berat_kg'] !== null) {
                $weight = required_number($body, 'berat_kg');
                if ($weight <= 0) {
                    fail(400, 'Berat harus lebih dari 0');
                }
                $sets[] = 'berat_kg = ?';
                $values[] = $weight;
            }
            if (array_key_exists('lokasi', $body) && $body['lokasi'] !== null) {
                if (!is_string($body['lokasi'])) {
                    fail(400, 'Field lokasi wajib berupa teks');
                }
                $sets[] = 'lokasi = ?';
                $values[] = $body['lokasi'];
            }
            if ($sets !== []) {
                $values[] = $id;
                $statement = $pdo->prepare('UPDATE sampah SET ' . implode(', ', $sets) . ' WHERE id = ?');
                $statement->execute($values);
            }
            send_json(['pesan' => "Sampah #{$id} berhasil diperbarui", 'data' => sampah_data(row_by_id($pdo, 'sampah', $id))]);
        }
    }
    if ($method === 'POST' && $path === '/sampah') {
        $body = json_body();
        $kind = required_text($body, 'jenis');
        if (!in_array($kind, ['Organik', 'Anorganik', 'B3'], true)) {
            fail(400, 'Jenis harus: Organik / Anorganik / B3');
        }
        $weight = required_number($body, 'berat_kg');
        if ($weight <= 0) {
            fail(400, 'Berat harus lebih dari 0');
        }
        $location = required_text($body, 'lokasi');
        $statement = $pdo->prepare('INSERT INTO sampah (jenis, berat_kg, lokasi, tingkat_bahaya, sudah_diambil, dibuat_pada) VALUES (?, ?, ?, ?, 0, ?)');
        $statement->execute([$kind, $weight, $location, hazard_for($kind), date('Y-m-d H:i:s')]);
        send_json(sampah_data(row_by_id($pdo, 'sampah', (int) $pdo->lastInsertId())), 201);
    }

    if ($method === 'GET' && $path === '/export/sampah') {
        $rows = $pdo->query('SELECT * FROM sampah ORDER BY id')->fetchAll();
        $csvRows = [];
        foreach ($rows as $row) {
            $csvRows[] = [
                $row['id'], $row['jenis'], $row['berat_kg'], $row['lokasi'], $row['tingkat_bahaya'],
                (bool) $row['sudah_diambil'] ? 'Sudah Diambil' : 'Belum Diambil',
                $row['dibuat_pada'] ? date('d/m/Y H:i', strtotime($row['dibuat_pada'])) : '-',
            ];
        }
        send_csv('data-sampah.csv', ['ID', 'Jenis', 'Berat (kg)', 'Lokasi', 'Tingkat Bahaya', 'Status', 'Dibuat Pada'], $csvRows);
    }
    if ($method === 'GET' && $path === '/export/laporan') {
        $rows = $pdo->query('SELECT * FROM laporan_harian ORDER BY id')->fetchAll();
        $csvRows = [];
        foreach ($rows as $row) {
            $csvRows[] = [$row['id'], $row['tanggal'], $row['total_sampah'], $row['total_berat_kg'], count(json_list($row['peringatan']))];
        }
        send_csv('laporan-harian.csv', ['ID', 'Tanggal', 'Total Sampah', 'Total Berat (kg)', 'Jumlah Peringatan'], $csvRows);
    }

    if ($method === 'GET' && $path === '/notifikasi') {
        $items = [];
        foreach ($pdo->query('SELECT * FROM tpa')->fetchAll() as $tpa) {
            if ((float) $tpa['kapasitas_ton'] <= 0) {
                continue;
            }
            $percentage = ((float) $tpa['terisi_ton'] / (float) $tpa['kapasitas_ton']) * 100;
            if ($percentage >= 90) {
                $items[] = ['level' => 'danger', 'pesan' => "TPA '{$tpa['nama']}' sudah " . number_format($percentage, 0) . '% penuh! Segera kosongkan.', 'icon' => 'fa-industry'];
            } elseif ($percentage >= 80) {
                $items[] = ['level' => 'warning', 'pesan' => "TPA '{$tpa['nama']}' hampir penuh (" . number_format($percentage, 0) . '%).', 'icon' => 'fa-industry'];
            }
        }
        $pending = (int) $pdo->query('SELECT COUNT(*) FROM sampah WHERE sudah_diambil = 0')->fetchColumn();
        if ($pending >= 10) {
            $items[] = ['level' => 'danger', 'pesan' => "Ada {$pending} sampah belum diambil! Segera tindaklanjuti.", 'icon' => 'fa-trash-can'];
        } elseif ($pending >= 5) {
            $items[] = ['level' => 'warning', 'pesan' => "{$pending} sampah masih belum diambil.", 'icon' => 'fa-trash-can'];
        }
        $serviceCount = (int) $pdo->query("SELECT COUNT(*) FROM kendaraan WHERE kondisi = 'Servis'")->fetchColumn();
        if ($serviceCount > 0) {
            $items[] = ['level' => 'warning', 'pesan' => "{$serviceCount} kendaraan sedang dalam perbaikan.", 'icon' => 'fa-wrench'];
        }
        $b3Count = (int) $pdo->query("SELECT COUNT(*) FROM sampah WHERE jenis = 'B3' AND sudah_diambil = 0")->fetchColumn();
        if ($b3Count > 0) {
            $items[] = ['level' => 'danger', 'pesan' => "{$b3Count} sampah B3 berbahaya belum ditangani!", 'icon' => 'fa-radiation'];
        }
        if ($items === []) {
            $items[] = ['level' => 'success', 'pesan' => 'Semua sistem berjalan normal.', 'icon' => 'fa-circle-check'];
        }
        send_json(['total' => count($items), 'items' => $items]);
    }

    if ($method === 'GET' && $path === '/statistik') {
        $allTrash = $pdo->query('SELECT jenis, berat_kg, lokasi, sudah_diambil FROM sampah')->fetchAll();
        $jenis = [];
        $locations = [];
        foreach ($allTrash as $row) {
            $jenis[$row['jenis']] = ($jenis[$row['jenis']] ?? 0) + 1;
            if (!isset($locations[$row['lokasi']])) {
                $locations[$row['lokasi']] = ['jumlah' => 0, 'urutan' => count($locations)];
            }
            $locations[$row['lokasi']]['jumlah']++;
        }
        uasort($locations, static function (array $left, array $right): int {
            return ($right['jumlah'] <=> $left['jumlah']) ?: ($left['urutan'] <=> $right['urutan']);
        });
        $topLocations = [];
        foreach (array_slice($locations, 0, 5, true) as $location => $summary) {
            $topLocations[] = ['lokasi' => $location, 'jumlah' => $summary['jumlah']];
        }
        $taken = 0;
        $weightByKind = ['Organik' => 0.0, 'Anorganik' => 0.0, 'B3' => 0.0];
        foreach ($allTrash as $row) {
            if ((bool) $row['sudah_diambil']) {
                $taken++;
            }
            if (array_key_exists($row['jenis'], $weightByKind)) {
                $weightByKind[$row['jenis']] += (float) $row['berat_kg'];
            }
        }
        $activeCrew = (int) $pdo->query('SELECT COUNT(*) FROM petugas WHERE status_aktif = 1')->fetchColumn();
        $inactiveCrew = (int) $pdo->query('SELECT COUNT(*) FROM petugas WHERE status_aktif = 0')->fetchColumn();
        send_json([
            'jenis' => $jenis,
            'status' => ['sudah' => $taken, 'belum' => count($allTrash) - $taken],
            'petugas' => ['aktif' => $activeCrew, 'nonaktif' => $inactiveCrew],
            'top_lokasi' => $topLocations,
            'total_berat_per_jenis' => array_map(static fn(float $weight): float => round($weight, 2), $weightByKind),
        ]);
    }

    if ($method === 'GET' && $path === '/statistik/harian') {
        $today = new DateTimeImmutable('today');
        $dayNames = [1 => 'Sen', 2 => 'Sel', 3 => 'Rab', 4 => 'Kam', 5 => 'Jum', 6 => 'Sab', 7 => 'Min'];
        $days = [];
        for ($offset = 6; $offset >= 0; $offset--) {
            $day = $today->modify('-' . $offset . ' days');
            $date = $day->format('Y-m-d');
            $stats = count_for_day($pdo, $date);
            $dayName = $dayNames[(int) $day->format('N')];
            $days[] = [
                'tanggal' => $date,
                'label' => $dayName . ' ' . $day->format('d/m'),
                'nama_hari' => $dayName,
                'total' => $stats['total'],
                'diambil' => $stats['diambil'],
                'belum' => $stats['total'] - $stats['diambil'],
                'berat_kg' => $stats['berat'],
                'b3' => $stats['b3'],
            ];
        }
        $weekTotal = array_sum(array_column($days, 'total'));
        $weekWeight = round(array_sum(array_column($days, 'berat_kg')), 2);
        $peak = $days[0];
        foreach ($days as $day) {
            if ($day['total'] > $peak['total']) {
                $peak = $day;
            }
        }
        send_json([
            'hari' => $days,
            'summary' => [
                'total_minggu' => $weekTotal,
                'berat_minggu' => $weekWeight,
                'avg_harian' => round($weekTotal / 7, 1),
                'hari_terbanyak' => $peak['label'],
                'max_count' => $peak['total'],
            ],
        ]);
    }
    if ($method === 'GET' && $path === '/statistik/realtime') {
        $today = new DateTimeImmutable('today');
        $current = count_for_day($pdo, $today->format('Y-m-d'));
        $previous = count_for_day($pdo, $today->modify('-1 day')->format('Y-m-d'));
        send_json([
            'hari_ini' => $current,
            'kemarin' => $previous,
            'perubahan' => [
                'total' => percent_change((float) $current['total'], (float) $previous['total']),
                'diambil' => percent_change((float) $current['diambil'], (float) $previous['diambil']),
                'berat' => percent_change((float) $current['berat'], (float) $previous['berat']),
            ],
        ]);
    }

    if ($method === 'GET' && $path === '/tpa') {
        $rows = $pdo->query('SELECT * FROM tpa ORDER BY id')->fetchAll();
        send_json(array_map('tpa_data', $rows));
    }
    if (preg_match('#^/tpa/(\d+)/terima/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $sampleId = (int) $match[2];
        $tpa = tpa_data(require_row($pdo, 'tpa', $id, 'TPA'));
        $sample = sampah_data(require_row($pdo, 'sampah', $sampleId, 'Sampah'));
        $weightTons = $sample['berat_kg'] / 1000;
        if ($tpa['terisi_ton'] + $weightTons > $tpa['kapasitas_ton']) {
            fail(400, 'TPA sudah penuh!');
        }
        $statement = $pdo->prepare('UPDATE tpa SET terisi_ton = terisi_ton + ? WHERE id = ?');
        $statement->execute([$weightTons, $id]);
        $updated = tpa_data(row_by_id($pdo, 'tpa', $id));
        send_json(['pesan' => "Sampah #{$sampleId} diterima di TPA '{$updated['nama']}'", 'tpa' => $updated]);
    }
    if (preg_match('#^/tpa/(\d+)/kosongkan$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $tpa = require_row($pdo, 'tpa', $id, 'TPA');
        $statement = $pdo->prepare('UPDATE tpa SET terisi_ton = 0, tgl_terakhir_dikosongkan = ? WHERE id = ?');
        $statement->execute([date('d F Y'), $id]);
        $updated = tpa_data(row_by_id($pdo, 'tpa', $id));
        send_json(['pesan' => "TPA '{$tpa['nama']}' berhasil dikosongkan", 'tpa' => $updated]);
    }
    if (preg_match('#^/tpa/(\d+)$#', $path, $match) && $method === 'DELETE') {
        $id = (int) $match[1];
        require_row($pdo, 'tpa', $id, 'TPA');
        $statement = $pdo->prepare('DELETE FROM tpa WHERE id = ?');
        $statement->execute([$id]);
        send_json(['pesan' => "TPA #{$id} berhasil dihapus"]);
    }
    if ($method === 'POST' && $path === '/tpa') {
        $body = json_body();
        $name = required_text($body, 'nama');
        $capacity = required_number($body, 'kapasitas_ton');
        if ($capacity <= 0) {
            fail(400, 'Kapasitas harus lebih dari 0');
        }
        $statement = $pdo->prepare("INSERT INTO tpa (nama, kapasitas_ton, terisi_ton, tgl_terakhir_dikosongkan) VALUES (?, ?, 0, '-')");
        $statement->execute([$name, $capacity]);
        send_json(tpa_data(row_by_id($pdo, 'tpa', (int) $pdo->lastInsertId())), 201);
    }

    if ($method === 'GET' && $path === '/petugas') {
        $rows = $pdo->query('SELECT * FROM petugas ORDER BY id')->fetchAll();
        send_json(array_map('petugas_data', $rows));
    }
    if (preg_match('#^/petugas/(\d+)/(nonaktifkan|aktifkan)$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $crew = require_row($pdo, 'petugas', $id, 'Petugas');
        $active = $match[2] === 'aktifkan';
        $statement = $pdo->prepare('UPDATE petugas SET status_aktif = ? WHERE id = ?');
        $statement->execute([$active ? 1 : 0, $id]);
        $word = $active ? 'diaktifkan kembali' : 'dinonaktifkan';
        send_json(['pesan' => "Petugas {$crew['nama']} {$word}", 'data' => petugas_data(row_by_id($pdo, 'petugas', $id))]);
    }
    if (preg_match('#^/petugas/(\d+)/edit$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $crew = require_row($pdo, 'petugas', $id, 'Petugas');
        $body = json_body();
        $sets = [];
        $values = [];
        foreach (['nama', 'zona_tugas'] as $field) {
            if (isset($body[$field]) && $body[$field] !== '') {
                if (!is_string($body[$field])) {
                    fail(400, "Field {$field} wajib berupa teks");
                }
                $sets[] = $field . ' = ?';
                $values[] = $body[$field];
            }
        }
        if ($sets !== []) {
            $values[] = $id;
            $statement = $pdo->prepare('UPDATE petugas SET ' . implode(', ', $sets) . ' WHERE id = ?');
            $statement->execute($values);
        }
        $updated = petugas_data(row_by_id($pdo, 'petugas', $id));
        send_json(['pesan' => "Data petugas {$updated['nama']} berhasil diperbarui", 'data' => $updated]);
    }
    if (preg_match('#^/petugas/(\d+)/kumpulkan/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $sampleId = (int) $match[2];
        $crew = petugas_data(require_row($pdo, 'petugas', $id, 'Petugas'));
        $sample = sampah_data(require_row($pdo, 'sampah', $sampleId, 'Sampah'));
        if (!$crew['status_aktif']) {
            fail(400, "Petugas {$crew['nama']} sedang tidak aktif");
        }
        if ($sample['sudah_diambil']) {
            fail(400, 'Sampah sudah diambil sebelumnya');
        }
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE sampah SET sudah_diambil = 1 WHERE id = ?')->execute([$sampleId]);
        $pdo->prepare('UPDATE petugas SET total_ambil = total_ambil + 1 WHERE id = ?')->execute([$id]);
        $pdo->commit();
        send_json(['pesan' => "Petugas {$crew['nama']} berhasil mengambil sampah #{$sampleId}"]);
    }
    if (preg_match('#^/petugas/(\d+)$#', $path, $match) && $method === 'DELETE') {
        $id = (int) $match[1];
        require_row($pdo, 'petugas', $id, 'Petugas');
        $statement = $pdo->prepare('DELETE FROM petugas WHERE id = ?');
        $statement->execute([$id]);
        send_json(['pesan' => "Petugas #{$id} berhasil dihapus"]);
    }
    if ($method === 'POST' && $path === '/petugas') {
        $body = json_body();
        $name = required_text($body, 'nama');
        $zone = required_text($body, 'zona_tugas');
        $statement = $pdo->prepare('INSERT INTO petugas (nama, zona_tugas, total_ambil, status_aktif) VALUES (?, ?, 0, 1)');
        $statement->execute([$name, $zone]);
        send_json(petugas_data(row_by_id($pdo, 'petugas', (int) $pdo->lastInsertId())), 201);
    }

    if ($method === 'GET' && $path === '/kendaraan') {
        $rows = $pdo->query('SELECT * FROM kendaraan ORDER BY id')->fetchAll();
        send_json(array_map('kendaraan_data', $rows));
    }
    if (preg_match('#^/kendaraan/(\d+)/muat/(\d+)$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $sampleId = (int) $match[2];
        $vehicle = kendaraan_data(require_row($pdo, 'kendaraan', $id, 'Kendaraan'));
        $sample = sampah_data(require_row($pdo, 'sampah', $sampleId, 'Sampah'));
        if ($vehicle['kondisi'] === 'Servis') {
            fail(400, "Kendaraan {$vehicle['plat_nomor']} sedang servis");
        }
        if ($vehicle['muatan_kg'] + $sample['berat_kg'] > $vehicle['kapasitas_kg']) {
            fail(400, 'Kendaraan sudah penuh!');
        }
        $route = array_values(array_filter(array_map('trim', explode(',', (string) $vehicle['rute']))));
        if (!in_array($sample['lokasi'], $route, true)) {
            $route[] = $sample['lokasi'];
        }
        $statement = $pdo->prepare('UPDATE kendaraan SET muatan_kg = muatan_kg + ?, rute = ? WHERE id = ?');
        $statement->execute([$sample['berat_kg'], implode(',', $route), $id]);
        $updated = kendaraan_data(row_by_id($pdo, 'kendaraan', $id));
        send_json(['pesan' => "Sampah #{$sampleId} dimuat ke kendaraan {$updated['plat_nomor']}", 'kendaraan' => $updated]);
    }
    if (preg_match('#^/kendaraan/(\d+)/(bongkar|servis)$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $vehicle = require_row($pdo, 'kendaraan', $id, 'Kendaraan');
        if ($match[2] === 'bongkar') {
            $pdo->prepare("UPDATE kendaraan SET muatan_kg = 0, rute = '', kondisi = 'Baik' WHERE id = ?")->execute([$id]);
            $updated = kendaraan_data(row_by_id($pdo, 'kendaraan', $id));
            send_json(['pesan' => "Kendaraan {$vehicle['plat_nomor']} berhasil dibongkar muatannya", 'kendaraan' => $updated]);
        }
        $pdo->prepare("UPDATE kendaraan SET kondisi = 'Servis' WHERE id = ?")->execute([$id]);
        $updated = kendaraan_data(row_by_id($pdo, 'kendaraan', $id));
        send_json(['pesan' => "Kendaraan {$vehicle['plat_nomor']} dikirim ke servis", 'kendaraan' => $updated]);
    }
    if (preg_match('#^/kendaraan/(\d+)$#', $path, $match) && $method === 'DELETE') {
        $id = (int) $match[1];
        require_row($pdo, 'kendaraan', $id, 'Kendaraan');
        $statement = $pdo->prepare('DELETE FROM kendaraan WHERE id = ?');
        $statement->execute([$id]);
        send_json(['pesan' => "Kendaraan #{$id} berhasil dihapus"]);
    }
    if ($method === 'POST' && $path === '/kendaraan') {
        $body = json_body();
        $plate = required_text($body, 'plat_nomor');
        $capacity = required_number($body, 'kapasitas_kg');
        if ($capacity <= 0) {
            fail(400, 'Kapasitas harus lebih dari 0');
        }
        $existing = $pdo->prepare('SELECT id FROM kendaraan WHERE plat_nomor = ?');
        $existing->execute([$plate]);
        if ($existing->fetchColumn() !== false) {
            fail(400, 'Plat nomor sudah terdaftar');
        }
        $statement = $pdo->prepare("INSERT INTO kendaraan (plat_nomor, kapasitas_kg, muatan_kg, kondisi, rute) VALUES (?, ?, 0, 'Baik', '')");
        $statement->execute([$plate, $capacity]);
        send_json(kendaraan_data(row_by_id($pdo, 'kendaraan', (int) $pdo->lastInsertId())), 201);
    }

    if ($method === 'GET' && $path === '/laporan') {
        $rows = $pdo->query('SELECT * FROM laporan_harian ORDER BY id DESC')->fetchAll();
        send_json(array_map(static fn(array $row): array => laporan_data($row), $rows));
    }
    if (preg_match('#^/laporan/(\d+)/peringatan$#', $path, $match) && $method === 'PATCH') {
        $id = (int) $match[1];
        $report = require_row($pdo, 'laporan_harian', $id, 'Laporan');
        $message = required_text(json_body(), 'pesan');
        $warnings = json_list($report['peringatan']);
        $warnings[] = $message;
        $statement = $pdo->prepare('UPDATE laporan_harian SET peringatan = ? WHERE id = ?');
        $statement->execute([json_encode($warnings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
        send_json(['pesan' => 'Peringatan ditambahkan', 'peringatan' => $warnings]);
    }
    if (preg_match('#^/laporan/(\d+)$#', $path, $match)) {
        $id = (int) $match[1];
        if ($method === 'GET') {
            send_json(laporan_data(require_row($pdo, 'laporan_harian', $id, 'Laporan'), true));
        }
        if ($method === 'DELETE') {
            require_row($pdo, 'laporan_harian', $id, 'Laporan');
            $statement = $pdo->prepare('DELETE FROM laporan_harian WHERE id = ?');
            $statement->execute([$id]);
            send_json(['pesan' => "Laporan #{$id} berhasil dihapus"]);
        }
    }
    if ($method === 'POST' && $path === '/laporan') {
        $body = json_body();
        $date = required_text($body, 'tanggal');
        $takenRows = $pdo->query('SELECT id, jenis, berat_kg, lokasi FROM sampah WHERE sudah_diambil = 1')->fetchAll();
        $notes = [];
        $warnings = [];
        $weight = 0.0;
        foreach ($takenRows as $row) {
            $weight += (float) $row['berat_kg'];
            $notes[] = "Sampah #{$row['id']} ({$row['jenis']}) dari {$row['lokasi']}";
            if ($row['jenis'] === 'B3') {
                $warnings[] = "Sampah B3 #{$row['id']} dari {$row['lokasi']} – perlu penanganan khusus!";
            }
        }
        $statement = $pdo->prepare('INSERT INTO laporan_harian (tanggal, total_sampah, total_berat_kg, catatan, peringatan, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([
            $date,
            count($takenRows),
            $weight,
            json_encode($notes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode($warnings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            date('Y-m-d H:i:s'),
        ]);
        send_json([
            'id' => (int) $pdo->lastInsertId(),
            'tanggal' => $date,
            'total_sampah' => count($takenRows),
            'total_berat_kg' => $weight,
            'catatan' => $notes,
            'peringatan' => $warnings,
        ], 201);
    }

    fail(404, 'Endpoint tidak ditemukan');
} catch (Throwable $error) {
    error_log('SmartWaste PHP API: ' . $error->getMessage());
    fail(500, 'Terjadi kesalahan server. Periksa konfigurasi PHP dan database SQLite.');
}
