@echo off
title Sistema Portaria e Servico Social - HNSBC
echo ========================================================
echo   Iniciando o Sistema Portaria e Servico Social
echo ========================================================
echo.

echo [1/2] Iniciando Servidor Backend (FastAPI)...
if exist "%~dp0venv\Scripts\python.exe" (
    start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend" && "%~dp0venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000"
) else (
    start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --port 8000"
)

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Servidor Frontend (Next.js)...
start "Frontend - Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak >nul

echo Abrindo aplicacao no navegador...
start http://localhost:3000

echo.
echo ========================================================
echo   Tudo pronto!
echo   - Frontend: http://localhost:3000
echo   - Backend API Docs: http://localhost:8000/docs
echo ========================================================
pause
