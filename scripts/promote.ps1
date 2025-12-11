<#
.SYNOPSIS
  ANCLORA DEV SHELL — PROMOTE FULL v3.0
.DESCRIPTION
  Sincroniza todas las ramas principales (development, main, preview, production)
  a partir de la más reciente, aplicando rebase limpio y push seguro.
  Incluye validación de autor, logs automáticos y control visual de estado.
#>

# --- 🧭 Inicialización ---------------------------------------------------------
Clear-Host
Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v3.0`n" -ForegroundColor Cyan

# --- 📘 Configuración básica ---------------------------------------------------
$ErrorActionPreference = "Stop"
$repoName = Split-Path -Leaf (Get-Location)
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logDir = "logs"
$logFile = "$logDir/promote_$timestamp.txt"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Start-Transcript -Path $logFile | Out-Null

# --- 🧑‍💻 Validar autor --------------------------------------------------------
$userName = (git config user.name | Out-String).Trim()
$userEmail = (git config user.email | Out-String).Trim()
$allowedAuthor = "ToniIAPro73 <supertoniia@gmail.com>"

if (-not $userName -or -not $userEmail) {
    Write-Host "⚠️ No se detectó configuración de autor en Git." -ForegroundColor Yellow
    Write-Host "   Ejecuta:`n   git config --global user.name 'ToniIAPro73'`n   git config --global user.email 'supertoniia@gmail.com'`n"
    Stop-Transcript | Out-Null
    exit 1
}

$author = "$userName <$userEmail>"

if ($author -ne $allowedAuthor) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($author)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
} else {
    Write-Host "✅ Autorización verificada: $author`n" -ForegroundColor Green
}

# --- 🧩 Función de utilidad ----------------------------------------------------
function Sync-Branch {
    param(
        [string]$branch,
        [string]$baseBranch
    )

    Write-Host "`n📦 Procesando rama '$branch'..." -ForegroundColor Cyan

    try {
        git fetch origin $branch | Out-Null
        git checkout $branch | Out-Null
        git pull origin $branch --rebase | Out-Null
        Write-Host "🪄 Rebasando sobre '$baseBranch'..." -ForegroundColor DarkYellow
        git rebase $baseBranch | Out-Null
        Write-Host "✅ Rebase completado: $branch ← $baseBranch" -ForegroundColor Green
        git push origin $branch --force-with-lease | Out-Null
        Write-Host "⬆️ Push completado para '$branch'" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error al procesar '$branch': $_" -ForegroundColor Red
    }
}

# --- 🔄 Sincronización ---------------------------------------------------------
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Yellow
git fetch --all --prune | Out-Null

$latestCommit = git log -1 --format="%h|%ad" --date=format:"dd/MM/yyyy HH:mm:ss" development
$split = $latestCommit.Split("|")
Write-Host "`n📍 Rama más reciente detectada: development ($($split[1]))`n" -ForegroundColor White

# --- 🧹 Detectar cambios locales ------------------------------------------------
if ((git status --porcelain) -ne "") {
    Write-Host "⚠️ Hay cambios sin commit en tu entorno local." -ForegroundColor Yellow
    $choice = Read-Host "¿Deseas crear un backup automático antes de continuar? (S/N)"
    if ($choice -eq "S") {
        $backupBranch = "backup/$($timestamp)"
        git checkout -b $backupBranch | Out-Null
        git add -A
        git commit -m "Backup automático antes de promote" | Out-Null
        git push origin $backupBranch | Out-Null
        Write-Host "💾 Backup creado: $backupBranch`n" -ForegroundColor Green
        git checkout development | Out-Null
    } else {
        Write-Host "🚫 Abortado por el usuario para evitar pérdida de cambios." -ForegroundColor Red
        Stop-Transcript | Out-Null
        exit 1
    }
}

# --- 🚀 Proceso principal ------------------------------------------------------
Sync-Branch "development" "development"
Sync-Branch "main" "development"
Sync-Branch "preview" "development"
Sync-Branch "production" "development"

# --- 🧾 Limpieza final ---------------------------------------------------------
Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (rebase limpio aplicado)." -ForegroundColor Green
Write-Host "🕒 Finalizado: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White

Stop-Transcript | Out-Null
