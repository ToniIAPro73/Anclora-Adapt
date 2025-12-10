[CmdletBinding()]
param(
  [switch]$SkipModels,
  [switch]$SkipPythonDeps,
  [switch]$SkipNodeDeps,
  [switch]$SkipHealth
)

$ErrorActionPreference = "Stop"

function Write-Section($text) {
  Write-Host ""
  Write-Host ("=" * 80)
  Write-Host ("= {0}" -f $text)
  Write-Host ("=" * 80)
}

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$MaxAttempts = 3,
    [int]$InitialDelayMs = 2000
  )

  $delay = $InitialDelayMs
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      & $Action
      return
    } catch {
      if ($attempt -eq $MaxAttempts) {
        throw $_
      }
      Write-Warning ("Intento {0} falló: {1}. Reintentando en {2} ms..." -f $attempt, $_.Exception.Message, $delay)
      Start-Sleep -Milliseconds $delay
      $delay = [Math]::Min($delay * 2, 15000)
    }
  }
}

function Get-InstalledOllamaModels {
  if (-not (Test-Command "ollama")) {
    return @()
  }
  try {
    $json = & ollama list --json 2>$null
    if (-not $json) { return @() }
    $parsed = $json | ConvertFrom-Json
    if ($parsed -is [System.Collections.IEnumerable] -and $parsed.Count -gt 0 -and $parsed[0].name) {
      return $parsed | ForEach-Object { $_.name }
    }
    elseif ($parsed.models) {
      return $parsed.models | ForEach-Object { $_.name }
    }
  } catch {
    Write-Warning "No se pudo leer la lista de modelos de Ollama: $($_.Exception.Message)"
  }
  return @()
}

function Ensure-OllamaModels {
  param(
    [string]$ConfigPath
  )

  if ($SkipModels) {
    Write-Host "Salteando descarga de modelos (--SkipModels)." -ForegroundColor Yellow
    return
  }
  if (-not (Test-Command "ollama")) {
    throw "Ollama no está disponible en el PATH. Instálalo o ajusta las variables."
  }

  $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
  $required = @()
  $required += $config.text
  $required += $config.vision
  $installed = Get-InstalledOllamaModels

  foreach ($entry in $required) {
    $modelName = $entry.name
    if ($installed -contains $modelName) {
      Write-Host "✓ $modelName ya está instalado." -ForegroundColor DarkGreen
      continue
    }
    Write-Host "Descargando $modelName ..." -ForegroundColor Yellow
    Invoke-WithRetry -Action {
      & ollama pull $modelName
      if ($LASTEXITCODE -ne 0) {
        throw "ollama pull $modelName falló."
      }
    }
    Write-Host "✓ $modelName disponible." -ForegroundColor Green
  }

  # Mostrar advertencias sobre dependencias manuales (kokoro/faster-whisper)
  foreach ($tts in $config.audio.tts) {
    if (-not (Test-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\$($tts.path)") -ErrorAction SilentlyContinue))) {
      Write-Warning ("Falta el archivo {0}. Descárgalo desde {1}" -f $tts.path, $tts.source)
    }
  }

  if (-not $SkipPythonDeps) {
    Test-PythonDeps
  }
}

function Test-PythonModule($module) {
  $cmd = "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('$module') else 1)"
  python -c $cmd
  return $LASTEXITCODE -eq 0
}

function Test-PythonDeps {
  $modules = @("diffusers", "faster_whisper")
  foreach ($module in $modules) {
    if (Test-PythonModule $module) {
      Write-Host "✓ Módulo Python disponible: $module" -ForegroundColor DarkGreen
    } else {
      Write-Warning "No se encontró el módulo Python '$module'. Ejecuta 'pip install $module' en tu virtualenv."
    }
  }
}

function Check-NodeDeps {
  if ($SkipNodeDeps) {
    Write-Host "Saltando chequeo de dependencias Node (--SkipNodeDeps)." -ForegroundColor Yellow
    return
  }
  if (-not (Test-Command "npm")) {
    Write-Warning "npm no está disponible. Instala Node.js para continuar."
    return
  }
  $packageLock = Join-Path $PSScriptRoot "..\\package-lock.json"
  if (-not (Test-Path $packageLock)) {
    Write-Warning "package-lock.json no encontrado. Ejecuta npm install manualmente."
    return
  }
  Write-Host "Verificando dependencias Node..." -ForegroundColor Yellow
  Invoke-WithRetry -Action {
    Push-Location (Join-Path $PSScriptRoot "..")
    try {
      npm install --prefer-offline | Out-Null
    } finally {
      Pop-Location
    }
  } -MaxAttempts 2
  Write-Host "Dependencias Node listas." -ForegroundColor Green
}

function Run-HealthChecks {
  if ($SkipHealth) {
    Write-Host "Saltando health checks (--SkipHealth)." -ForegroundColor Yellow
    return
  }

  Write-Section "Health checks"
  $healthScript = Join-Path $PSScriptRoot "check-endpoints.js"
  if (Test-Path $healthScript) {
    try {
      node $healthScript
    } catch {
      Write-Warning "Health check Node falló: $($_.Exception.Message)"
    }
  } else {
    Write-Warning "No se encontró scripts/check-endpoints.js para health check."
  }
}

Write-Section "Bootstrap Anclora"

if (-not (Test-Command "python")) {
  throw "Python no está disponible en el PATH."
}
if (-not (Test-Command "node")) {
  throw "Node.js no está disponible en el PATH."
}
if (-not (Test-Command "npm")) {
  Write-Warning "npm no encontrado; algunas tareas no podrán ejecutarse."
}
if (-not (Test-Command "ollama")) {
  Write-Warning "Ollama no encontrado; la descarga automática de modelos se omitirá."
}

Ensure-OllamaModels -ConfigPath (Join-Path $PSScriptRoot "..\\provisioning\\models.json")
Check-NodeDeps

Write-Host "Ejecuta 'python -m venv venv && pip install -r requirements.txt' en python-backend si aún no lo hiciste." -ForegroundColor Cyan
Write-Host "Ejecuta 'npm run dev' y 'python python-backend/main.py' para lanzar los servidores." -ForegroundColor Cyan

Run-HealthChecks

Write-Host "`nBootstrap completado. Usa scripts/cache-maintenance.ps1 para limpiar cachés periódicamente." -ForegroundColor Green
