[CmdletBinding()]
param(
  [string]$OutputDirectory = "infra/livekit/generated",
  [string]$GeneratorImage = "livekit/generate:latest"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destination = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Path $destination -Force | Out-Null

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker Engine is unavailable." }

Write-Host "Pulling the official LiveKit configuration generator..."
& docker pull $GeneratorImage
if ($LASTEXITCODE -ne 0) { throw "Could not pull the official LiveKit generator." }

Write-Host "Starting the official interactive generator. Use separate Voice and TURN DNS names pointing to the server."
& docker run --rm -it --mount "type=bind,source=$destination,target=/output" $GeneratorImage
if ($LASTEXITCODE -ne 0) { throw "LiveKit configuration generation failed." }

$generated = Get-ChildItem -LiteralPath $destination -Directory -ErrorAction SilentlyContinue
if (-not $generated) { throw "The generator did not create a deployment directory." }

Write-Host "Generated deployment directories:"
$generated | ForEach-Object { Write-Host " - $($_.FullName)" }
Write-Host "Generated files are gitignored because livekit.yaml contains API credentials."
