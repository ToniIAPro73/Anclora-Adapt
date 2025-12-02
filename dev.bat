@echo off
REM Script para ejecutar npm run dev de forma segura
REM Limpia puertos viejos y ejecuta la aplicación

echo Limpiando puertos 4173 y 4174...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4173"') do (
    taskkill /PID %%a /F /T >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4174"') do (
    taskkill /PID %%a /F /T >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo.
echo ✓ Puertos limpiados. Iniciando aplicación...
echo.

npm run dev
