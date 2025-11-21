<#
.SYNOPSIS
  Recuperador interactivo de ramas Git para estructura Anclora.

.DESCRIPTION
  Permite restaurar ramas específicas dentro del flujo:
    - development → main
    - main → preview
    - preview → production
  Incluye detección automática, backups y confirmaciones visuales.

.EXAMPLES
  ./scripts/anclora_git_recover.ps1
#>

Write-Host "`n⚓ ANCLORA GIT RECOVER - Modo Interactivo" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor DarkGray

if (-not (Test-Path ".git")) {
    Write-Host "❌ No estás dentro de un repositorio Git." -ForegroundColor Red
    exit 1
}

git fetch origin | Out-Null

$branches = git branch -r | ForEach-Object { $_.Trim() }

function Detect-Branch($patterns) {
    foreach ($p in $patterns) {
        $match = $branches | Where-Object { $_ -match "origin/$p$" }
        if ($match) { return $p }
    }
    return $null
}

$devBranch = Detect-Branch @("development")
$mainBranch = Detect-Branch @("main","master")
$previewBranch = Detect-Branch @("preview")
$prodBranch = Detect-Branch @("production")

Write-Host "`n📦 Ramas detectadas:"
Write-Host "  🧩 Development: $devBranch"
Write-Host "  🔹 Main:        $mainBranch"
Write-Host "  🌤️ Preview:     $previewBranch"
Write-Host "  🚀 Production:  $prodBranch"

if (-not $devBranch -or -not $mainBranch) {
    Write-Host "❌ Faltan ramas esenciales (development/main)." -ForegroundColor Red
    exit 1
}

function Backup-Branch($branchName) {
    $timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")
    $backupBranch = "backup/$branchName-$timestamp"
    git branch $backupBranch $branchName
    Write-Host "💾 Copia de seguridad creada: $backupBranch" -ForegroundColor Green
}

function Restore-Branch($from, $to) {
    Write-Host "`n🔄 Restaurando $to desde $from..." -ForegroundColor Yellow
    $confirm = Read-Host "⚠️ Esto sobrescribirá '$to' con el contenido de '$from'. ¿Continuar? (s/n)"
    if ($confirm -ne "s" -and $confirm -ne "S") { Write-Host "⏭️ Cancelado."; return }

    Backup-Branch $to
    git fetch origin
    git checkout $to
    git pull origin $to
    git checkout $from -- .
    git add .
    git commit -m "🔄 Restore $to from $from (Anclora Interactive)"
    git push origin $to --force-with-lease
    Write-Host "✅ Restauración completada: '$to' contiene el contenido de '$from'." -ForegroundColor Green
}

Write-Host "`nSelecciona la operación:" -ForegroundColor Yellow
Write-Host "  1️⃣  Development → Main"
Write-Host "  2️⃣  Main → Preview"
Write-Host "  3️⃣  Preview → Production"
Write-Host "  4️⃣  Manual (elegir Source y Target)"
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor DarkGray

$choice = Read-Host "Selecciona una opción (1–4)"

switch ($choice) {
    1 { Restore-Branch $devBranch $mainBranch }
    2 { Restore-Branch $mainBranch $previewBranch }
    3 { Restore-Branch $previewBranch $prodBranch }
    4 {
        $from = Read-Host "Rama fuente"
        $to = Read-Host "Rama destino"
        Restore-Branch $from $to
    }
    default { Write-Host "❌ Opción inválida."; exit 1 }
}

Write-Host "`n🏁 Proceso completado correctamente." -ForegroundColor Cyan
