<#
    ANCLORA DEV SHELL — PROMOTE FULL v2.8
    Autor: Antonio Ballesteros Alonso
    Descripción:
      Sincroniza todas las ramas del proyecto con rebase limpio sobre la más actual.
      Previene commits no autorizados y genera logs detallados.

#>

param(
    [switch]$Force
)

# ======================
# ⚙️ CONFIGURACIÓN
# ======================
$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logDir = "logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
Start-Transcript -Path "$logDir/promote_$timestamp.txt" -Append | Out-Null

Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.8`n" -ForegroundColor Cyan

# ======================
# 🧩 AUTORIZACIÓN
# ======================
$allowedAuthors = @(
    "Antonio Ballesteros Alonso <toni@uniestate.co.uk>",
    "ToniIAPro73 <supertoniia@gmail.com>",
    "Toni Ballesteros <antonio@anclora.com>"
)

$currentAuthor = (git config user.name) + " <" + (git config user.email) + ">"

if ($allowedAuthors -notcontains $currentAuthor) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($currentAuthor)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}

Write-Host "✅ Autorización verificada: $currentAuthor`n" -ForegroundColor Green

# ======================
# 🔄 SINCRONIZACIÓN GLOBAL
# ======================
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Yellow
git fetch --all --prune | Out-Null

# Determinar la rama más reciente
$branches = @("development", "main", "preview", "production")
$latestBranch = ""
$latestDate = Get-Date "2000-01-01"

foreach ($b in $branches) {
    $commitDate = git log origin/$b -1 --format="%ci" 2>$null
    if ($commitDate -and ([datetime]$commitDate -gt $latestDate)) {
        $latestBranch = $b
        $latestDate = [datetime]$commitDate
    }
}

if (-not $latestBranch) {
    Write-Host "❌ No se pudieron obtener commits remotos válidos." -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}

Write-Host "`n📍 Rama más reciente detectada: $latestBranch ($latestDate)`n" -ForegroundColor Green

# ======================
# 🧠 REBASE LIMPIO
# ======================
foreach ($branch in $branches) {
    Write-Host "`n📦 Procesando rama '$branch'..." -ForegroundColor Yellow

    try {
        git checkout $branch -q
        git pull origin $branch --rebase | Out-Null

        if ($branch -ne $latestBranch) {
            Write-Host "🪄 Rebasando sobre '$latestBranch'..." -ForegroundColor Cyan
            git rebase origin/$latestBranch
            Write-Host "✅ Rebase completado: $branch ← $latestBranch" -ForegroundColor Green
        }
        git push origin $branch --force-with-lease
        Write-Host "⬆️ Push completado para '$branch'" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️ Error en '$branch': $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Intenta resolver manualmente y relanza el promote." -ForegroundColor Yellow
    }
}

# ======================
# 🧾 RESUMEN FINAL
# ======================
Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (rebase limpio aplicado)."
Write-Host "🕒 Finalizado: $(Get-Date -Format 'HH:mm:ss')`n" -ForegroundColor Green
Stop-Transcript | Out-Null
