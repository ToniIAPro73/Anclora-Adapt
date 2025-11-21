<#
.SYNOPSIS
  Sincroniza todas las ramas principales (development → main → preview → production)
  y reinyecta commits adelantados desde ramas superiores si existen.

.DESCRIPTION
  Este script:
  - Actualiza referencias remotas.
  - Detecta commits adelantados en ramas superiores.
  - Ofrece integrarlos en development con rebase.
  - Fusiona jerárquicamente en orden.
  - Hace rebase final para evitar desfases (“X commits behind”).
  - Limpia logs antiguos automáticamente.
#>

# ==========================
# ⚙️ CONFIGURACIÓN INICIAL
# ==========================
$ErrorActionPreference = "Stop"
$repoRoot = (git rev-parse --show-toplevel)
Set-Location $repoRoot

$logDir = Join-Path $repoRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# 🧹 Limpieza automática de logs antiguos (>24h)
Get-ChildItem $logDir -Filter "promote_*.txt" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

# Crear nuevo log
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "promote_$timestamp.txt"
Start-Transcript -Path $logFile | Out-Null

Write-Host ""
Write-Host "⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.5" -ForegroundColor Cyan
Write-Host ""

# ==========================
# 🧭 DETECTAR RAMAS
# ==========================
$branches = git branch --format="%(refname:short)"
$mainBranch = if ($branches -match 'main') { 'main' } elseif ($branches -match 'master') { 'master' } else { 'main' }
$devBranch = if ($branches -match 'development') { 'development' } else { Read-Host "❓ Nombre de tu rama de desarrollo" }
$previewBranch = if ($branches -match 'preview') { 'preview' } else { '' }
$productionBranch = if ($branches -match 'production') { 'production' } else { '' }

Write-Host "🔹 Ramas detectadas:"
Write-Host "   Dev: $devBranch"
Write-Host "   Main: $mainBranch"
if ($previewBranch) { Write-Host "   Preview: $previewBranch" }
if ($productionBranch) { Write-Host "   Production: $productionBranch" }
Write-Host ""

# ==========================
# 🔄 ACTUALIZAR REMOTOS
# ==========================
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Yellow
git fetch --all | Out-Null

# ==========================
# 🧠 DETECTAR COMMITS ADELANTADOS
# ==========================
function Check-Divergence($source, $target) {
    $counts = git rev-list --left-right --count $source...$target | Out-String
    $split = $counts -split "\s+"
    $ahead = [int]($split[0].Trim())
    $behind = [int]($split[1].Trim())
    return @{ Ahead = $ahead; Behind = $behind }
}

Write-Host "🧭 Verificando si hay commits adelantados en ramas superiores..." -ForegroundColor Yellow
$upstreamBranches = @($mainBranch, $previewBranch, $productionBranch) | Where-Object { $_ -ne '' }
$rebased = $false

foreach ($up in $upstreamBranches) {
    $div = Check-Divergence "origin/$devBranch" "origin/$up"
    if ($div.Behind -gt 0) {
        Write-Host "⚠️  '$up' tiene $($div.Behind) commits no presentes en '$devBranch'." -ForegroundColor Yellow
        $choice = Read-Host "¿Deseas integrarlos en '$devBranch' antes de promover? (S/N)"
        if ($choice -match '^[sS]$') {
            Write-Host "🔁 Rebasando '$devBranch' con cambios de '$up'..." -ForegroundColor Green
            git checkout $devBranch
            git pull origin $up --rebase
            $rebased = $true
        }
    }
}

if (-not $rebased) {
    Write-Host "✅ No hay commits adelantados que integrar." -ForegroundColor Green
}
Write-Host ""

# ==========================
# 🚀 FUNCIÓN DE PROMOCIÓN
# ==========================
function Promote($source, $target) {
    Write-Host "🔁 Fusionando $source → $target..." -ForegroundColor Green
    git checkout $target
    git pull origin $target --rebase
    git merge $source -m "🔀 Promote $source → $target"
    git push origin $target
}

# ==========================
# 🔗 EJECUCIÓN PRINCIPAL
# ==========================
Promote $devBranch $mainBranch
if ($previewBranch) { Promote $mainBranch $previewBranch }
if ($productionBranch) { Promote $previewBranch $productionBranch }

# ==========================
# 🧩 REBASE FINAL DE DEVELOPMENT
# ==========================
Write-Host "`n🔄 Realizando rebase final de '$devBranch'..." -ForegroundColor Yellow
git checkout $devBranch
git fetch origin $devBranch
git pull --rebase origin $devBranch
git push origin $devBranch

# ==========================
# ✅ FINALIZACIÓN
# ==========================
Write-Host ""
Write-Host "🏁 Sincronización completa sin divergencias." -ForegroundColor Cyan
Stop-Transcript | Out-Null
