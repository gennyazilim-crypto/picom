[CmdletBinding()]
param(
  [ValidateSet('development', 'staging', 'production')]
  [string]$Environment = 'development',
  [ValidateSet('plan', 'smoke')]
  [string]$Mode = 'plan',
  [string]$OutputRoot = '',
  [switch]$WritePlan
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot 'tmp\backup-plans'
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputRoot)
$allowedRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'tmp\backup-plans'))

function Stop-Unsafe([string]$Message) {
  Write-Error "BACKUP_PLACEHOLDER_BLOCKED: $Message"
  exit 2
}

if ($Environment -eq 'production') {
  Stop-Unsafe 'This placeholder never connects to or writes production backups.'
}
if (-not $resolvedOutput.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Stop-Unsafe "Output must remain inside $allowedRoot"
}

$plan = [ordered]@{
  schemaVersion = 1
  kind = 'picom-backup-plan-placeholder'
  environment = $Environment
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  destructiveOperation = $false
  providerCommandExecuted = $false
  includes = @(
    'Supabase Postgres managed backup/PITR policy verification',
    'public/auth/storage metadata inventory',
    'private storage bucket object inventory and provider export plan',
    'versioned migrations and Edge Function source from Git',
    'secret-name inventory from approved secret manager without secret values'
  )
  excludes = @(
    'database passwords and connection strings',
    'Supabase access/service-role keys',
    'LiveKit and OAuth secrets',
    'signed URLs, auth tokens, and private content samples'
  )
  requiredFollowUp = @(
    'provider backup completion evidence',
    'encrypted artifact checksums',
    'isolated staging restore verification',
    'storage object/metadata reconciliation',
    'redacted restore drill report'
  )
}

if ($Mode -eq 'smoke') {
  if ($plan.destructiveOperation -or $plan.providerCommandExecuted) { Stop-Unsafe 'Smoke invariant failed.' }
  Write-Output 'PASS backup placeholder is non-destructive and secret-free by construction.'
  exit 0
}

$plan | ConvertTo-Json -Depth 5
if (-not $WritePlan) {
  Write-Output 'PLAN_ONLY: no file, provider API, database, or storage operation was performed.'
  exit 0
}
if ($Environment -ne 'staging' -or $env:PICOM_BACKUP_PLAN_CONFIRM -ne 'staging-plan-only') {
  Stop-Unsafe 'Writing a staging plan requires PICOM_BACKUP_PLAN_CONFIRM=staging-plan-only.'
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$fileName = 'backup-plan-{0}.json' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$target = Join-Path $resolvedOutput $fileName
$plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $target -Encoding utf8NoBOM
Write-Output "WROTE_PLAN: $target"
Write-Output 'No backup command was executed. Use the reviewed provider/CI workflow described in docs/ops/automated-backups.md.'
