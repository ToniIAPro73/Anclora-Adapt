# Script para matar procesos en puertos específicos
# Uso: .\kill-port.ps1 4173

param(
    [int]$Port = 4173
)

Write-Host "Buscando procesos en puerto $Port..." -ForegroundColor Yellow

$process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($process) {
    $pid = $process.OwningProcess
    Write-Host "Encontrado proceso con PID: $pid" -ForegroundColor Cyan

    $procName = (Get-Process -Id $pid).ProcessName
    Write-Host "Nombre del proceso: $procName" -ForegroundColor Cyan

    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Proceso $pid ($procName) terminado" -ForegroundColor Green
} else {
    Write-Host "No hay procesos en puerto $Port" -ForegroundColor Green
}
