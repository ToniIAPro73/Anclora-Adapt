<#
=====================================================================
⚓ ANCLORA DEV SHELL — PROMOTE FULL v3.3
Autor: Toni Ballesteros
Descripción:
  Sincroniza todas las ramas principales del repositorio (development,
  main, preview, production) usando como fuente la rama más reciente.
  Incluye:
  - Detección y confirmación automática si promote.ps1 fue modificado.
  - Protección de secretos optimizada (solo en rutas relevantes).
  - Retorno automático a la rama original.
=====================================================================
#>

# -----------------------------
# 🔧 CONFIGURACIÓN INICIAL
# -----------------------------
$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "logs/promote_$timestamp.txt"

if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

Start-Transcript -Path $logFile -Append | Out-Null
Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v3.3`n" -ForegroundColor Cyan

# -----------------------------
# 🧩 AUTORIZACIÓN SEGURA
# -----------------------------
try {
    $gitUserName = (git config user.name 2>$null).Trim()
    $gitUserEmail = (git config user.email 2>$null).Trim()

    if (-not $gitUserName -or -not $gitUserEmail) {
        Write-Host "⚠️  No se pudo obtener configuración de Git. Usando valores por defecto..." -ForegroundColor Yellow
        $gitUserName = "ToniIAPro73"
        $gitUserEmail = "supertoniia@gmail.com"
    }

    Write-Host "✅ Autorización verificada: $gitUserName <$gitUserEmail>`n" -ForegroundColor Green
}
catch {
    Write-Host "🚫 Error al determinar usuario de Git. Abortando..." -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}

# -----------------------------
# 🧠 AUTODETECCIÓN DE CAMBIOS EN EL PROPIO SCRIPT
# -----------------------------
$scriptPath = "scripts/promote.ps1"
if (git status --porcelain $scriptPath | Select-String -Quiet "M") {
    Write-Host "⚠️ Se detectaron cambios sin commit en promote.ps1." -ForegroundColor Yellow
    $resp = Read-Host "¿Deseas hacer commit y push automático antes de continuar? (S/N)"
    if ($resp -match '^[sS]$') {
        try {
            git add $scriptPath
            git commit -m "🔄 promote.ps1 actualizado automáticamente (v3.3)" | Out-Null
            git push origin HEAD | Out-Null
            Write-Host "✅ promote.ps1 actualizado y sincronizado correctamente.`n" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ No se pudo hacer commit automático del script. Continúa sin sincronizar." -ForegroundColor Red
        }
    } else {
        Write-Host "⏭️  Se omite la sincronización del propio script.`n" -ForegroundColor DarkGray
    }
}

# -----------------------------
# 🔐 PROTECCIÓN DE SECRETOS (OPTIMIZADA)
# -----------------------------
Write-Host "🔐 Aplicando protección de secretos optimizada..." -ForegroundColor Yellow

$protectedPatterns = @(".env*", "*.db")
$protectedDirs = @(".", "docker", "python-backend")

foreach ($dir in $protectedDirs) {
    if (Test-Path $dir) {
        Get-ChildItem -Path $dir -Include $protectedPatterns -File -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "🧱 Protegido: $($_.FullName)" -ForegroundColor DarkGray
            git update-index --assume-unchanged $_.FullName 2>$null
        }
    }
}

# -----------------------------
# 🕒 SINCRONIZACIÓN DE RAMAS
# -----------------------------
$branches = @("development", "main", "preview", "production")

# Guardar la rama actual (para volver al final)
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "`n📍 Rama actual detectada: $currentBranch`n" -ForegroundColor Cyan

# Actualizar referencias remotas
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Yellow
git fetch --all --prune | Out-Null

# Detectar la más reciente
$latest = $branches | ForEach-Object {
    $commitDate = git log -1 --format="%ct" $_ 2>$null
    if ($commitDate) { [PSCustomObject]@{ Name = $_; Date = [int]$commitDate } }
} | Sort-Object Date -Descending | Select-Object -First 1

if (-not $latest) {
    Write-Host "🚫 No se detectaron ramas válidas. Abortando..." -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}

$latestDate = (Get-Date ([datetime]"1970-01-01").AddSeconds($latest.Date) -Format "dd/MM/yyyy HH:mm:ss")
Write-Host "📍 Rama más reciente detectada: $($latest.Name) ($latestDate)`n" -ForegroundColor Cyan

# -----------------------------
# 🔁 PROCESAR CADA RAMA
# -----------------------------
foreach ($branch in $branches) {
    Write-Host "📦 Procesando rama '$branch'..." -ForegroundColor Cyan

    try {
        git checkout $branch | Out-Null
        git pull origin $branch --rebase | Out-Null

        if ($branch -ne $latest.Name) {
            Write-Host "🪄 Rebasando sobre '$($latest.Name)'..." -ForegroundColor Yellow
            git rebase $latest.Name | Out-Null
            Write-Host "✅ Rebase completado: $branch ← $($latest.Name)" -ForegroundColor Green
        }

        git push origin $branch --force-with-lease | Out-Null
        Write-Host "⬆️ Push completado para '$branch'`n" -ForegroundColor DarkGreen
    }
    catch {
        Write-Host "❌ Error en la rama '$branch': $_" -ForegroundColor Red
    }
}

# -----------------------------
# 🧹 LIMPIEZA Y RETORNO
# -----------------------------
git checkout $currentBranch | Out-Null
Write-Host "`n🔁 Has vuelto a tu rama original: $currentBranch" -ForegroundColor Cyan

Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (rebase limpio aplicado)." -ForegroundColor Green
Write-Host "🕒 Finalizado: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow

Stop-Transcript | Out-Null
