@echo off
REM Limpiar todos los puertos 4173 y 4174

echo Limpiando puertos 4173 y 4174...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4173"') do (
    echo Matando proceso en puerto 4173: %%a
    taskkill /PID %%a /F /T 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4174"') do (
    echo Matando proceso en puerto 4174: %%a
    taskkill /PID %%a /F /T 2>nul
)

timeout /t 2 /nobreak
echo Puertos limpiados. Ahora puedes ejecutar npm run dev
