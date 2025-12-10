param(
  [int]$MaxAgeDays = 7,
  [switch]$Vacuum
)

$ErrorActionPreference = "Stop"

Write-Host "Anclora - Cache maintenance" -ForegroundColor Cyan

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  throw "Python no está disponible en el PATH. Instálalo antes de ejecutar este script."
}

$scriptPath = Join-Path $PSScriptRoot "..\python-backend\scripts\cache_cleanup.py" | Resolve-Path
$argsList = @("--max-age-days", $MaxAgeDays.ToString())
if ($Vacuum) { $argsList += "--vacuum" }

Write-Host "Ejecutando limpieza..." -ForegroundColor Yellow
& $python $scriptPath @argsList
Write-Host "Limpieza finalizada." -ForegroundColor Green
