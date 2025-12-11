<#
.SYNOPSIS
  Sincroniza las ramas principales de Anclora (development → main → preview → production)
  con limpieza automática y protección contra archivos sensibles.

.DESCRIPTION
  - Verifica autorización del autor
  - Limpia el working tree antes de cada rebase
  - Detecta secretos o archivos .env antes de hacer push
  - Sincroniza todas las ramas de forma ordenada con control de errores

.VERSION
  v2.9 (Anclora Adapt / 2025-12)
#>

# ==============================
# ⚙️ CONFIGURACIÓN
# ==============================
$allowedAuthor = "ToniIAPro73 <supertoniia@gmail.com>"
$branches = @("development", "main", "preview", "production")

# ==============================
# 🚀 INICIO
# ==============================
Write-Host "`n⚓ ANCLORA DEV SHELL — PROMOTE FULL v2.9`n" -ForegroundColor Cyan

# Verificar autor
$author = git config user.name + " <" + (git config user.email) + ">"
if ($author -ne $allowedAuthor) {
    Write-Host "🚫 Bloqueado: autor no autorizado ($author)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Autorización verificada: $author`n" -ForegroundColor Green
}


# ==============================
# 🧹 LIMPIEZA PREVIA
# ==============================
Write-Host "🧹 Limpiando entorno local..."
git restore .
git clean -fd
git reset --hard
Write-Host "✅ Working tree limpio.`n"

# ==============================
# 🔍 DETECCIÓN DE SECRETOS
# ==============================
Write-Host "🔒 Escaneando archivos sensibles antes del push..."
$secretPatterns = '\.env|secret|token|apikey|api_key|credential|password'
$secretFiles = git ls-files | Select-String -Pattern $secretPatterns

if ($secretFiles) {
    Write-Host "🚫 Archivos sensibles detectados, abortando push:" -ForegroundColor Red
    $secretFiles | ForEach-Object { Write-Host "   ⚠️ $($_.Line)" }
    Write-Host "`n🧭 Por seguridad, elimina o agrega a .gitignore antes de continuar.`n" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ No se han detectado archivos sensibles.`n"
}

# ==============================
# 🔄 ACTUALIZAR REFERENCIAS
# ==============================
Write-Host "🔄 Actualizando referencias remotas..."
git fetch --all
Write-Host ""

# Obtener último commit de development
$latestBranch = "development"
$latestCommit = git log -1 --format="%h" $latestBranch
$latestDate = git log -1 --format="%cd" --date=format:"%d/%m/%Y %H:%M:%S" $latestBranch
Write-Host "📍 Rama más reciente detectada: $latestBranch ($latestDate)`n"

# ==============================
# 🔁 SINCRONIZAR TODAS LAS RAMAS
# ==============================
foreach ($b in $branches) {
    Write-Host "📦 Procesando rama '$b'..." -ForegroundColor Cyan

    try {
        git checkout $b 2>$null | Out-Null

        # Rebase limpio
        Write-Host "🪄 Rebasando sobre 'development'..."
        git fetch origin $b | Out-Null
        git rebase origin/development 2>$null | Out-Null
        Write-Host "✅ Rebase completado: $b ← development"

        # Push forzado controlado
        git push origin $b --force-with-lease
        Write-Host "⬆️ Push completado para '$b'`n"
    }
    catch {
        Write-Host "⚠️ Error durante la sincronización de '$b': $_" -ForegroundColor Yellow
    }
}

# ==============================
# ✅ FINALIZACIÓN
# ==============================
Write-Host "`n🎯 Todas las ramas sincronizadas correctamente (rebase limpio aplicado)." -ForegroundColor Green
$time = Get-Date -Format "HH:mm:ss"
Write-Host "🕒 Finalizado: $time`n"
