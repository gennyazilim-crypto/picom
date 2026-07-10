[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9]{8,32}$')]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [switch]$ConfirmStaging,

  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmStaging) {
  throw 'Refusing to continue without explicit -ConfirmStaging.'
}

if ($env:PICOM_PRODUCTION_SUPABASE_PROJECT_REF -and $ProjectRef -eq $env:PICOM_PRODUCTION_SUPABASE_PROJECT_REF) {
  throw 'Refusing to run the staging dry-run helper against the configured production project.'
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '..\supabase\migrations'))) {
  throw 'Run this helper from the Picom repository; supabase/migrations is missing.'
}

$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
  throw 'Supabase CLI is required. Install it, authenticate locally, and retry.'
}

Write-Host 'Picom Supabase staging migration dry run'
Write-Host "Project ref: $ProjectRef"
Write-Host "Apply after dry run: $Apply"

& supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw 'Supabase project link failed.' }

& supabase migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Could not list linked migration state.' }

& supabase db push --linked --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Supabase migration dry run failed.' }

if (-not $Apply) {
  Write-Host 'Dry run completed. No migration was applied.'
  exit 0
}

Write-Warning 'Applying reviewed migrations to the explicitly confirmed staging project.'
& supabase db push --linked
if ($LASTEXITCODE -ne 0) { throw 'Supabase staging migration apply failed.' }

& supabase migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Could not verify migration state after apply.' }

Write-Host 'Staging migrations applied. Complete the manual RLS/storage/realtime verification checklist.'
