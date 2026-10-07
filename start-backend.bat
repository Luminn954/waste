@echo off
setlocal
title SmartWaste PHP
cd /d "%~dp0"

set "PHP_BIN="
where php >nul 2>nul
if not errorlevel 1 set "PHP_BIN=php"
if not defined PHP_BIN if exist "C:\xampp\php\php.exe" set "PHP_BIN=C:\xampp\php\php.exe"

if not defined PHP_BIN (
  echo PHP tidak ditemukan. Pasang PHP 8.1+ atau XAMPP, lalu tambahkan php.exe ke PATH.
  pause
  exit /b 1
)

"%PHP_BIN%" -r "exit(extension_loaded('pdo_sqlite') ? 0 : 1);"
if errorlevel 1 (
  echo Ekstensi pdo_sqlite belum aktif di PHP. Aktifkan di php.ini XAMPP, lalu coba lagi.
  pause
  exit /b 1
)

echo SmartWaste berjalan di http://127.0.0.1:8090
"%PHP_BIN%" -S 127.0.0.1:8090 router.php
