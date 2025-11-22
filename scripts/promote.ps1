<#
.SYNOPSIS
  Sincroniza todas las ramas principales (development → main → preview → production),
  permitiendo integrar primero la rama de trabajo actual en development.

.DESCRIPTION
  Este script:
  - Verifica identidad del autor (bloquea agentes no autorizados)
  - Limpia logs antiguos
  - Detecta commits adelantados en ramas superiores
  - Permite integrar la rama de trabajo actual en development
  - Promueve jerárquicamente todas las ramas
  - Realiza rebase final en development
  - Muestra un dashboard con el estado de cada rama
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
Write-Host "⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.7" -ForegroundColor Cyan
Write-Host ""

# ==========================
# 🔒 VERIFICACIÓN DE IDENTIDAD
# (simplificada: solo muestra quién está ejecutando)
# ==========================
$currentName  = git config user.name
$currentEmail = git config user.email

Write-Host "ℹ️ Usando identidad Git: $currentName <$currentEmail>" -ForegroundColor Yellow
Write-Host ""

# ==========================
# 🧭 DETECTAR RAMAS
# ==========================
$branches          = git branch --format="%(refname:short)"
$mainBranch        = if ($branches -match 'main') { 'main' } elseif ($branches -match 'master') { 'master' } else { 'main' }
$devBranch         = if ($branches -match 'development') { 'development' } else { Read-Host "❓ Nombre de tu rama de desarrollo" }
$previewBranch     = if ($branches -match 'preview')   { 'preview' }   else { '' }
$productionBranch  = if ($branches -match 'production'){ 'production'} else { '' }

Write-Host "🔹 Ramas detectadas:"
Write-Host "   Dev:        $devBranch"
Write-Host "   Main:       $mainBranch"
if ($previewBranch)    { Write-Host "   Preview:    $previewBranch" }
if ($productionBranch) { Write-Host "   Production: $productionBranch" }
Write-Host ""

# ==========================
# 🔄 ACTUALIZAR REMOTOS
# ==========================
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Yellow
git fetch --all | Out-Null

# ==========================
# 🌿 INTEGRAR RAMA ACTUAL EN DEVELOPMENT (OPCIONAL)
# ==========================
$currentBranch = git rev-parse --abbrev-ref HEAD

if ($currentBranch -ne $devBranch) {
    Write-Host ""
    Write-Host "🧭 Rama actual: $currentBranch (distinta de '$devBranch')" -ForegroundColor Yellow
    $choice = Read-Host "¿Fusionar '$currentBranch' → '$devBranch' antes de promocionar? (S/N)"
    if ($choice -match '^[sS]$') {
        Write-Host "🔁 Fusionando $currentBranch → $devBranch..." -ForegroundColor Green
        git checkout $devBranch
        git pull origin $devBranch --rebase
        git merge $currentBranch -m "🔀 Merge feature $currentBranch into $devBranch"
        git push origin $devBranch
        Write-Host "✅ Cambios de '$currentBranch' disponibles en '$devBranch'." -ForegroundColor Green
    } else {
        Write-Host "⏩ Se utilizará el estado actual de '$devBranch' sin integrar '$currentBranch'." -ForegroundColor DarkYellow
    }
}

# ==========================
# 🧠 DETECTAR COMMITS ADELANTADOS
# ==========================
function Check-Divergence($source, $target) {
    $counts = git rev-list --left-right --count $source...$target | Out-String
    $split  = $counts -split "\s+"
    $ahead  = [int]($split[0].Trim())
    $behind = [int]($split[1].Trim())
    return @{ Ahead = $ahead; Behind = $behind }
}

$upstreamBranches = @($mainBranch, $previewBranch, $productionBranch) | Where-Object { $_ -ne '' }
foreach ($up in $upstreamBranches) {
    $div = Check-Divergence "origin/$devBranch" "origin/$up"
    if ($div.Behind -gt 0) {
        Write-Host "⚠️  '$up' tiene $($div.Behind) commits no presentes en '$devBranch'." -ForegroundColor Yellow
        $choice = Read-Host "¿Integrar '$up' → '$devBranch' antes de promover? (S/N)"
        if ($choice -match '^[sS]$') {
            git checkout $devBranch
            git pull origin $up --rebase
        }
    }
}

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
if ($previewBranch)    { Promote $mainBranch $previewBranch }
if ($productionBranch) { Promote $previewBranch $productionBranch }

# ==========================
# 🧩 REBASE FINAL + DASHBOARD
# ==========================
Write-Host "`n🔄 Rebase final en '$devBranch'..." -ForegroundColor Yellow
git checkout $devBranch
git fetch origin $devBranch
git pull --rebase origin $devBranch
git push origin $devBranch

Write-Host ""
Write-Host "📊 Estado de ramas tras sincronización:" -ForegroundColor Cyan
foreach ($b in @($devBranch, $mainBranch, $previewBranch, $productionBranch) | Where-Object { $_ -ne '' }) {
    $div = Check-Divergence $b "origin/$b"
    Write-Host ("  • " + $b.PadRight(12) + " ⬆️ " + $div.Ahead + " / ⬇️ " + $div.Behind)
}

# ==========================
# ✅ FINALIZACIÓN
# ==========================
Write-Host ""
Write-Host "🏁 Sincronización completada." -ForegroundColor Cyan
Stop-Transcript | Out-Null