$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = if ($env:ENV_FILE) { $env:ENV_FILE } else { Join-Path $RootDir '.env.production' }
$InfraFile = Join-Path $RootDir 'docker-compose.infra.yml'
$ServicesFile = Join-Path $RootDir 'docker-compose.services.yml'

if (-not (Test-Path $EnvFile)) {
  throw "Missing env file: $EnvFile"
}

function Invoke-Compose {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  & docker compose --env-file $EnvFile -f $InfraFile -f $ServicesFile @Args
}

function Get-ServiceContainerId {
  param([string]$Service)
  $id = Invoke-Compose ps -q $Service
  return ($id | Out-String).Trim()
}

function Get-ContainerHealthOrStatus {
  param([string]$ContainerId)
  (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $ContainerId | Out-String).Trim()
}

function Wait-ServiceHealthy {
  param(
    [string]$Service,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $containerId = Get-ServiceContainerId $Service
    if ($containerId) {
      $status = Get-ContainerHealthOrStatus $containerId
      if ($status -in @('healthy', 'running')) {
        Write-Host "$Service is $status"
        return
      }
      if ($status -in @('exited', 'dead')) {
        throw "$Service entered unexpected status: $status"
      }
    }
    Start-Sleep -Seconds 3
  }

  throw "Timed out waiting for $Service to become healthy."
}

function Wait-ServiceExitedSuccess {
  param(
    [string]$Service,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $containerId = Get-ServiceContainerId $Service
    if ($containerId) {
      $status = (& docker inspect --format '{{.State.Status}}' $containerId | Out-String).Trim()
      if ($status -eq 'exited') {
        $exitCode = (& docker inspect --format '{{.State.ExitCode}}' $containerId | Out-String).Trim()
        if ($exitCode -eq '0') {
          Write-Host "$Service completed successfully"
          return
        }
        Invoke-Compose logs $Service
        throw "$Service failed with exit code $exitCode"
      }
    }
    Start-Sleep -Seconds 3
  }

  Invoke-Compose logs $Service
  throw "Timed out waiting for $Service to exit successfully."
}

Write-Host 'Pulling latest images'
Invoke-Compose pull

Write-Host 'Starting infrastructure services'
Invoke-Compose up -d postgres redis
Wait-ServiceHealthy postgres 180
Wait-ServiceHealthy redis 180

Write-Host 'Running database migrations'
try {
  Invoke-Compose rm -sf migrate | Out-Null
} catch {
}
Invoke-Compose up -d migrate
Wait-ServiceExitedSuccess migrate 180

Write-Host 'Starting application services'
Invoke-Compose up -d hi-lo-server hi-lo-client hi-lo-admin hi-lo-merchant
Wait-ServiceHealthy hi-lo-server 240
Wait-ServiceHealthy hi-lo-client 180
Wait-ServiceHealthy hi-lo-admin 240
Wait-ServiceHealthy hi-lo-merchant 240

Write-Host 'Publishing gateway'
Invoke-Compose up -d nginx

Write-Host 'Deployment status'
Invoke-Compose ps

