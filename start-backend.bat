@echo off
setlocal
title SmartWaste Backend
pushd "%~dp0backend"
if errorlevel 1 (
  echo Folder backend tidak ditemukan: "%~dp0backend"
  pause
  exit /b 1
)
python -m uvicorn main:app --host 127.0.0.1 --port 8090
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
