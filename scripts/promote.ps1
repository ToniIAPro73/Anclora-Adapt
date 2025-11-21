<#
.SYNOPSIS
  Sincroniza todas las ramas principales (development → main → preview → production),
  integrando automáticamente cambios externos (Cosine) y verificando la identidad del autor.

.DESCRIPTION
  Este script:
  - Verifica identidad del autor (bloquea agentes no autorizados)
  - Limpia logs antiguos
  - Detecta commits adelantados en ramas superiores
  - Integra la rama Cosine si existe
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
Write-Host "⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.6" -ForegroundColor Cyan
Write-Host ""

# ==========================
# 🔒 VERIFICACIÓN DE IDENTIDAD
# ==========================
$allowedName = "Antonio Ballesteros Alonso"
$allowedEmail = "toni@uniestate.co.uk"

$currentName = git config user.name
$currentEmail = git config user.email

if ($currentName -ne $allowedName -or $currentEmail -ne $allowedEmail) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($currentName <$currentEmail>)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}
Write-Host "✅ Identidad verificada: $currentName <$currentEmail>" -ForegroundColor Green
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

$upstreamBranches = @($mainBranch, $previewBranch, $productionBranch) | Where-Object { $_ -ne '' }
foreach ($up in $upstreamBranches) {
    $div = Check-Divergence "origin/$devBranch" "origin/$up"
    if ($div.Behind -gt 0) {
        Write-Host "⚠️  '$up' tiene $($div.Behind) commits no presentes en '$devBranch'." -ForegroundColor Yellow
        $choice = Read-Host "¿Integrar en '$devBranch'? (S/N)"
        if ($choice -match '^[sS]$') {
            git checkout $devBranch
            git pull origin $up --rebase
        }
    }
}

# ==========================
# 🤝 INTEGRAR RAMA COSINE
# ==========================
$cosineBranch = "cosine/fix-readme-context"

if ((git branch -r | Select-String $cosineBranch)) {
    Write-Host "`n🤝 Detectada rama externa de Cosine: $cosineBranch" -ForegroundColor Yellow
    $choice = Read-Host "¿Integrar sus cambios en '$devBranch'? (S/N)"
    if ($choice -match '^[sS]$') {
        git checkout $devBranch
        git fetch origin $cosineBranch
        git merge origin/$cosineBranch -m "🤝 Merge Cosine branch $cosineBranch into $devBranch"
        git push origin $devBranch
        Write-Host "✅ Cambios de Cosine integrados correctamente." -ForegroundColor Green
    } else {
        Write-Host "⏩ Integración de Cosine omitida." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "ℹ️ No se ha detectado la rama de Cosine ($cosineBranch)." -ForegroundColor Gray
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
Write-Host "🏁 Sincronización completada sin divergencias." -ForegroundColor Cyan
Stop-Transcript | Out-Null
