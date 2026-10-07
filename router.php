<?php
declare(strict_types=1);

$frontendRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'frontend');
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$requestPath = rawurldecode($requestPath);
$relativePath = trim($requestPath, '/');
if ($relativePath === '') {
    $relativePath = 'index.html';
}

$staticFile = $frontendRoot === false ? false : realpath($frontendRoot . DIRECTORY_SEPARATOR . $relativePath);
$isInsideFrontend = $staticFile !== false
    && $frontendRoot !== false
    && str_starts_with($staticFile, $frontendRoot . DIRECTORY_SEPARATOR);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if (($method === 'GET' || $method === 'HEAD') && $isInsideFrontend && is_file($staticFile)) {
    $types = [
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
    ];
    $extension = strtolower(pathinfo($staticFile, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Cache-Control: no-cache');
    if ($method === 'GET') {
        readfile($staticFile);
    }
    exit;
}

require __DIR__ . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'index.php';
