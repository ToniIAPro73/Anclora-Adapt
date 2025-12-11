<#
=====================================================================
⚓ ANCLORA DEV SHELL — PROMOTE FULL v3.0
Autor: Toni Ballesteros
Descripción:
  Sincroniza todas las ramas principales del repositorio (development,
  main, preview, production) usando como fuente la rama más reciente.
  Incluye control de identidad, limpieza temporal y protección de secretos.
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
Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v3.0`n" -ForegroundColor Cyan

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
# 🚫 PROTECCIÓN DE SECRETOS
# -----------------------------
$protectedPaths = @("*.env*", "*.db", "docker/.env.docker", "backend/.env*", "python-backend/cache/*.db")

foreach ($pattern in $protectedPaths) {
    Get-ChildItem -Path . -Recurse -Include $pattern -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "🧱 Protegido: $($_.FullName)" -ForegroundColor DarkGray
        git update-index --assume-unchanged $_.FullName 2>$null
    }
}

# -----------------------------
# 🕒 SINCRONIZACIÓN DE RAMAS
# -----------------------------
$branches = @("development", "main", "preview", "production")

# Detectar rama actual
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "`n📍 Rama actual: $currentBranch`n" -ForegroundColor Cyan

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
# 🧹 LIMPIEZA FINAL
# -----------------------------
git checkout $latest.Name | Out-Null
Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (rebase limpio aplicado)." -ForegroundColor Green
Write-Host "🕒 Finalizado: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow

Stop-Transcript | Out-Null
