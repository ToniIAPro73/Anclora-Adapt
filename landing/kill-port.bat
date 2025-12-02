@echo off
REM Script para matar procesos en puerto 4173
REM Uso: kill-port.bat

setlocal enabledelayedexpansion

set PORT=4173

echo Buscando procesos en puerto %PORT%...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%"') do (
    set PID=%%a
    echo Encontrado PID: !PID!

    for /f "tokens=*" %%b in ('tasklist /FI "PID eq !PID!" /FO "TABLE" ^| findstr /V "PID"') do (
        echo Nombre: %%b
    )

    taskkill /PID !PID! /F /T
    if errorlevel 1 (
        echo Error al matar proceso !PID!
    ) else (
        echo ✓ Proceso !PID! terminado exitosamente
    )
)

echo.
echo Listo. El puerto %PORT% debería estar libre.
echo.
pause
