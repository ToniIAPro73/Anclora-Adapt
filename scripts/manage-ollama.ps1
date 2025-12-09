#requires -version 5.1
<#
.SYNOPSIS
  Reinicia el daemon de Ollama y muestra los modelos instalados.

.DESCRIPTION
  - Enumera los modelos disponibles usando `ollama list`.
  - Permite seleccionar un modelo (solo informativo).
  - Antes de levantar `ollama serve`, detiene el servicio “Ollama” (si existe)
    y mata cualquier proceso que siga escuchando en el puerto 11434.
  - Inicia un nuevo proceso `ollama serve` en segundo plano.

.NOTES
  Ejecuta este script desde la raíz del proyecto:
  `pwsh .\scripts\manage-ollama.ps1`
#>

param (
  [int]$Port = 11434
)

function Get-OllamaModels {
  $raw = & ollama list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo obtener la lista de modelos. ¿Está instalado Ollama?"
  }

  $lines = $raw | Where-Object { $_ -match '\S' } | Select-Object -Skip 1
  $models = @()

  foreach ($line in $lines) {
    # Parseo más robusto: nombre modelo, ID, tamaño, fecha modificada
    # Formato: "nombre    id          tamaño    fecha"
    if ($line -match '^\s*(\S+)\s+(\S+)\s+(\S+)\s+(.+?)$') {
      $models += [pscustomobject]@{
        Name     = $matches[1]
        Id       = $matches[2]
        Size     = $matches[3]
        Modified = $matches[4].Trim()
      }
    }
  }
  return $models
}

function Select-Model {
  param (
    [Parameter(Mandatory)]
    [array]$Models
  )

  Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host "  MODELOS DISPONIBLES" -ForegroundColor Cyan
  Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

  for ($i = 0; $i -lt $Models.Count; $i++) {
    $color = if ($Models[$i].Name -match "qwen") { "Yellow" } else { "White" }
    Write-Host ("[{0}] {1,-20} {2,-15} {3}" -f $i, $Models[$i].Name, $Models[$i].Size, $Models[$i].Modified) -ForegroundColor $color
  }

  Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
  $selection = Read-Host "`nSelecciona el número del modelo (o pulsa Enter para omitir)"
  if ([string]::IsNullOrWhiteSpace($selection)) {
    return $null
  }

  if ($selection -as [int] -ge 0 -and $selection -as [int] -lt $Models.Count) {
    return $Models[$selection -as [int]].Name
  }

  Write-Warning "Selección inválida. Se continuará sin modelo preferido."
  return $null
}

function Stop-OllamaInstances {
  param (
    [int]$PortToFree
  )

  $service = Get-Service -Name "Ollama" -ErrorAction SilentlyContinue
  if ($service -and $service.Status -eq 'Running') {
    Write-Host "Deteniendo servicio 'Ollama'..." -ForegroundColor Yellow
    Stop-Service -Name "Ollama" -Force -ErrorAction SilentlyContinue
  }

  $connections = Get-NetTCPConnection -LocalPort $PortToFree -ErrorAction SilentlyContinue
  if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processes) {
      try {
        Write-Host "Matando proceso con PID $processId que usa el puerto $PortToFree..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction Stop
      } catch {
        Write-Warning ("No se pudo detener el proceso {0}: {1}" -f $processId, $_)
      }
    }
  }
}

function Start-OllamaServe {
  Write-Host "Iniciando ollama serve..." -ForegroundColor Cyan
  $process = Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -PassThru -ErrorAction Stop
  return $process
}

function Run-Model {
  param (
    [string]$ModelName
  )

  if ([string]::IsNullOrWhiteSpace($ModelName)) {
    return
  }

  Write-Host "`nEjecutando 'ollama run $ModelName' para precargar el modelo..." -ForegroundColor Cyan
  try {
    & ollama run $ModelName "Hello from manage-ollama.ps1" | Out-Null
    Write-Host "Modelo $ModelName precargado." -ForegroundColor Green
  } catch {
    Write-Warning "No se pudo hacer 'ollama run $ModelName': $_"
  }
}

try {
  Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "║         GESTOR DE OLLAMA - ANCLORA ADAPT                  ║" -ForegroundColor Cyan
  Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

  $models = Get-OllamaModels
  if (-not $models -or $models.Count -eq 0) {
    throw "No se detectaron modelos instalados. Ejecuta 'ollama pull <modelo>'."
  }

  Write-Host "`n✓ Se encontraron $($models.Count) modelo(s) instalado(s)" -ForegroundColor Green

  $selectedModel = Select-Model -Models $models

  Write-Host "`n⏳ Preparando parada de instancias anteriores..." -ForegroundColor Yellow
  Stop-OllamaInstances -PortToFree $Port

  if ($selectedModel) {
    Write-Host "`n📦 Precargando modelo: $selectedModel" -ForegroundColor Cyan
    Run-Model -ModelName $selectedModel
  }

  $serveProcess = Start-OllamaServe

  Write-Host "`n✓ Daemon reiniciado correctamente (PID $($serveProcess.Id))" -ForegroundColor Green
  Write-Host "  Puerto: $Port" -ForegroundColor Gray
  Write-Host "  URL:    http://localhost:$Port" -ForegroundColor Gray
  Write-Host "`n💡 Para detenerlo pulsa Ctrl+C o cierra esta ventana." -ForegroundColor Gray
} catch {
  Write-Error $_
  exit 1
}
