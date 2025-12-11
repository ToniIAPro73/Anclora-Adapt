<#
.SYNOPSIS
  ANCLORA DEV SHELL — PROMOTE LITE v1.0
.DESCRIPTION
  Sincroniza las ramas principales (development, main, preview, production)
  con la rama base 'development', sin logs ni confirmaciones.
#>

Clear-Host
Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE LITE v1.0`n" -ForegroundColor Cyan
$ErrorActionPreference = "Stop"

# --- 🧑‍💻 Validar autor --------------------------------------------------------
$userName = (git config user.name | Out-String).Trim()
$userEmail = (git config user.email | Out-String).Trim()
$allowedAuthor = "ToniIAPro73 <supertoniia@gmail.com>"
$author = "$userName <$userEmail>"

if ($author -ne $allowedAuthor) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($author)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Autorización verificada: $author`n" -ForegroundColor Green
}

# --- 🌐 Verificar y crear remoto 'origin' si falta ----------------------------
$repoName = Split-Path -Leaf (Get-Location)
if (-not (git remote | Select-String "origin")) {
    Write-Host "⚠️ No se detectó remoto 'origin'. Creándolo automáticamente..." -ForegroundColor Yellow
    git remote add origin https://github.com/ToniIAPro73/$repoName.git
    Write-Host "✅ Remoto 'origin' configurado correctamente.`n" -ForegroundColor Green
}

# --- 🧹 Limpiar posibles rebases previos --------------------------------------
if (Test-Path ".git/rebase-merge") {
    Write-Host "⚠️ Se detectó un rebase interrumpido. Abortando..." -ForegroundColor Yellow
    git rebase --abort | Out-Null
    Write-Host "✅ Entorno restaurado.`n" -ForegroundColor Green
}

# --- 🔄 Función de sincronización rápida --------------------------------------
function Sync-Branch {
    param([string]$branch, [string]$baseBranch)

    Write-Host "`n📦 Procesando rama '$branch'..." -ForegroundColor Cyan
    try {
        git fetch origin $branch | Out-Null
        git checkout $branch | Out-Null
        git rebase $baseBranch | Out-Null
        Write-Host "✅ Rebase completado: $branch ← $baseBranch" -ForegroundColor Green
        git push origin $branch --force-with-lease | Out-Null
        Write-Host "⬆️ Push completado para '$branch'" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error al procesar '$branch': $_" -ForegroundColor Red
        git rebase --abort 2>$null
    }
}

# --- 🚀 Ejecutar sincronización rápida ----------------------------------------
git fetch --all --prune | Out-Null
Write-Host "🔄 Sincronizando todas las ramas principales..." -ForegroundColor Yellow

Sync-Branch "development" "development"
Sync-Branch "main" "development"
Sync-Branch "preview" "development"
Sync-Branch "production" "development"

Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (modo rápido)." -ForegroundColor Green
Write-Host "🕒 Finalizado: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White
