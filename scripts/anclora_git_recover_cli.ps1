<#
.SYNOPSIS
  Recuperador universal de ramas Git (modo CLI) para estructura Anclora.

.DESCRIPTION
  Permite restaurar ramas específicas dentro del flujo:
   - development → main
   - main → preview
   - preview → production
  Crea backups automáticos antes de cada restauración.

.PARAMETER Mode
  Modo de restauración:
    - DevToMain
    - MainToPreview
    - PreviewToProduction
    - Manual (si se especifican Source y Target)

.PARAMETER Source
  Rama fuente opcional (por ejemplo "development").

.PARAMETER Target
  Rama destino opcional (por ejemplo "main").

.EXAMPLES
  ./scripts/anclora_git_recover_cli.ps1 -Mode DevToMain -AutoConfirm $true
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("DevToMain", "MainToPreview", "PreviewToProduction", "Manual")]
    [string]$Mode = "Manual",

    [Parameter(Mandatory = $false)]
    [string]$Source,

    [Parameter(Mandatory = $false)]
    [string]$Target,

    [Parameter(Mandatory = $false)]
    [bool]$AutoConfirm = $false
)

Write-Host "`n⚓ ANCLORA GIT RECOVER CLI - Universal Recovery System" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor DarkGray

# --- 1️⃣ Validar entorno Git ---
if (-not (Test-Path ".git")) {
    Write-Host "❌ No estás dentro de un repositorio Git." -ForegroundColor Red
    exit 1
}

# --- 2️⃣ Detectar ramas activas ---
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

Write-Host "📦 Ramas detectadas:"
Write-Host "  🧩 Development: $devBranch"
Write-Host "  🔹 Main:        $mainBranch"
Write-Host "  🌤️ Preview:     $previewBranch"
Write-Host "  🚀 Production:  $prodBranch"

# --- 3️⃣ Confirmación auxiliar ---
function Confirm-Action($msg) {
    if ($AutoConfirm) { return $true }
    $input = Read-Host "$msg (s/n)"
    return ($input -in @("s","S"))
}

# --- 4️⃣ Función de backup ---
function Backup-Branch($branchName) {
    $timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")
    $backupBranch = "backup/$branchName-$timestamp"
    git branch $backupBranch $branchName
    Write-Host "💾 Copia de seguridad creada: $backupBranch" -ForegroundColor Green
}

# --- 5️⃣ Función principal ---
function Restore-Branch($from, $to) {
    Write-Host "`n🔄 Restaurando $to desde $from..." -ForegroundColor Yellow
    if (-not (Confirm-Action "⚠️ Esto sobrescribirá '$to' con el contenido de '$from'. ¿Continuar?")) {
        Write-Host "⏭️ Operación cancelada."
        exit 0
    }

    Backup-Branch $to
    git fetch origin
    git checkout $to
    git pull origin $to
    git checkout $from -- .
    git add .
    git commit -m "🔄 Restore $to from $from (Anclora CLI)"
    git push origin $to --force-with-lease
    Write-Host "✅ Restauración completada: '$to' contiene el contenido de '$from'." -ForegroundColor Green
}

# --- 6️⃣ Seleccionar modo ---
switch ($Mode) {
    "DevToMain"           { Restore-Branch $devBranch $mainBranch }
    "MainToPreview"       { Restore-Branch $mainBranch $previewBranch }
    "PreviewToProduction" { Restore-Branch $previewBranch $prodBranch }
    "Manual" {
        if (-not $Source -or -not $Target) {
            Write-Host "❌ Debes especificar -Source y -Target en modo Manual." -ForegroundColor Red
            exit 1
        }
        Restore-Branch $Source $Target
    }
}

Write-Host "`n🏁 Proceso de recuperación finalizado." -ForegroundColor Cyan
