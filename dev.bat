@echo off
REM Script para limpiar puertos y ejecutar Vite
REM Este script limpia los puertos antes de ejecutar Vite directamente

echo Limpiando puertos 4173 y 4174...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4173"') do (
    taskkill /PID %%a /F /T >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4174"') do (
    taskkill /PID %%a /F /T >nul 2>&1
)

cls
echo.
echo Puertos limpiados. Iniciando Vite...
echo.

REM Ejecutar Vite directamente (no npm run dev para evitar loop)
npx vite
