<#
.SYNOPSIS
  🔁 Sincroniza todas las ramas principales del proyecto (development, main, preview, production)
  usando la más reciente como fuente. Incluye control de autoría, backups automáticos y logs detallados.

.DESCRIPTION
  Este script detecta la rama más actualizada (por commits), sincroniza el resto con ella
  y genera un log en /logs con los resultados del proceso.

.VERSION
  v2.7 – Protección de autoría (solo ToniIAPro73 o cuentas autorizadas)
  Última revisión: 22/11/2025
#>

# ==========================
# 🧭 CONFIGURACIÓN BÁSICA
# ==========================
$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logDir = "logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = "$logDir/promote_$timestamp.txt"
Start-Transcript -Path $logFile -Force | Out-Null

Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.7`n" -ForegroundColor Cyan

# ==========================
# 🧩 AUTORIZACIÓN DE AUTOR
# ==========================
$allowedAuthors = @(
    "Antonio Ballesteros Alonso <toni@uniestate.co.uk>",
    "ToniIAPro73 <supertoniia@gmail.com>",
    "Toni Ballesteros <antonio@anclora.com>"
)
)

$lastCommitAuthor = git log -1 --pretty=format:"%an <%ae>"
if ($allowedAuthors -notcontains $lastCommitAuthor) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($lastCommitAuthor)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}

Write-Host "✅ Autorización verificada: $lastCommitAuthor`n" -ForegroundColor Green

# ==========================
# 🔄 ACTUALIZACIÓN REMOTA
# ==========================
Write-Host "🔄 Actualizando referencias remotas..." -ForegroundColor Cyan
git fetch --all --prune | Out-Null

# ==========================
# 📋 DEFINICIÓN DE RAMAS
# ==========================
$branches = @("development", "main", "preview", "production")

# Detecta cuál es la más reciente por fecha de commit
$latest = $branches |
    ForEach-Object {
        [PSCustomObject]@{
            Name = $_
            Date = (git log origin/$_ -1 --format="%ci")
        }
    } | Sort-Object Date -Descending | Select-Object -First 1

Write-Host "🧭 Último commit detectado:`n   → Rama: $($latest.Name)`n   → Fecha: $($latest.Date)`n" -ForegroundColor Yellow

# ==========================
# 💾 BACKUP AUTOMÁTICO
# ==========================
$uncommitted = git status --porcelain
if ($uncommitted) {
    Write-Host "⚠️ Hay cambios sin commit en tu entorno local."
    $resp = Read-Host "¿Deseas crear un backup automático antes de continuar? (S/N)"
    if ($resp -eq "S") {
        $backupBranch = "backup/$($timestamp)"
        git checkout -b $backupBranch
        git add .
        git commit -m "🧩 Backup automático previo al promote ($timestamp)"
        git push origin $backupBranch
        Write-Host "✅ Backup creado en rama: $backupBranch`n" -ForegroundColor Green
    } else {
        Write-Host "⏭️ Continuando sin backup..." -ForegroundColor Yellow
    }
}

# ==========================
# 🔁 SINCRONIZACIÓN DE RAMAS
# ==========================
foreach ($b in $branches) {
    if ($b -ne $latest.Name) {
        Write-Host "➡️ Sincronizando '$b' con '$($latest.Name)'..." -ForegroundColor Cyan
        git checkout $b | Out-Null
        git pull origin $b | Out-Null
        git merge origin/$($latest.Name) --no-edit | Out-Null

        # Verifica si hay commits locales pendientes
        $aheadOutput = git rev-list --left-right --count "$b...origin/$b"
        $split = $aheadOutput -split "\s+"
        $ahead = [int]$split[0]
        $behind = [int]$split[1]

        if ($ahead -gt 0) {
            Write-Host "⬆️ Subiendo cambios locales de '$b'..." -ForegroundColor Yellow
            git push origin $b
        } elseif ($behind -gt 0) {
            Write-Host "⬇️ Actualizando '$b' desde remoto..." -ForegroundColor Yellow
            git pull origin $b
        } else {
            Write-Host "✅ '$b' ya está sincronizada." -ForegroundColor Green
        }
    }
}

# ==========================
# 🏁 FINALIZACIÓN
# ==========================
git checkout $latest.Name | Out-Null
Write-Host "`n🎯 Promoción completada. Todas las ramas sincronizadas con '$($latest.Name)'.`n" -ForegroundColor Green
Stop-Transcript | Out-Null
