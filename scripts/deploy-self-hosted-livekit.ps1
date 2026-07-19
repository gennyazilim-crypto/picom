[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [Parameter(Mandatory = $true)][string]$SshUser,
  [Parameter(Mandatory = $true)][string]$GeneratedConfigDirectory,
  [int]$SshPort = 22,
  [string]$RemoteDirectory = "/opt/livekit",
  [switch]$UseSudo
)

$ErrorActionPreference = "Stop"
if ($Server -notmatch '^[A-Za-z0-9.-]+$') { throw "Server must be a hostname or IPv4 address." }
if ($SshUser -notmatch '^[A-Za-z_][A-Za-z0-9_-]{0,31}$') { throw "SSH user contains unsupported characters." }
if ($RemoteDirectory -notmatch '^/[A-Za-z0-9._/-]+$') { throw "Remote directory is invalid." }
if ($SshPort -lt 1 -or $SshPort -gt 65535) { throw "SSH port is invalid." }

$source = [IO.Path]::GetFullPath($GeneratedConfigDirectory)
$required = @("docker-compose.yaml", "livekit.yaml", "redis.conf", "caddy.yaml")
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $name) -PathType Leaf)) { throw "Missing generated file: $name" }
}

foreach ($tool in @("ssh", "scp")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is unavailable. Install the Windows OpenSSH Client." }
}

$target = "${SshUser}@${Server}"
$stage = ".picom-livekit-upload-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"

function Invoke-Native([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE." }
}

Invoke-Native "ssh" @("-p", "$SshPort", $target, "install -d -m 700 '$stage'")
foreach ($name in $required) {
  Invoke-Native "scp" @("-P", "$SshPort", (Join-Path $source $name), "${target}:$stage/$name")
}

$privilege = if ($UseSudo) { "sudo " } else { "" }
$remote = @"
set -eu
${privilege}install -d -m 700 '$RemoteDirectory'
${privilege}cp '$stage/docker-compose.yaml' '$RemoteDirectory/docker-compose.yaml'
${privilege}cp '$stage/livekit.yaml' '$RemoteDirectory/livekit.yaml'
${privilege}cp '$stage/redis.conf' '$RemoteDirectory/redis.conf'
${privilege}cp '$stage/caddy.yaml' '$RemoteDirectory/caddy.yaml'
cd '$RemoteDirectory'
${privilege}docker compose -f docker-compose.yaml config --quiet
${privilege}docker compose -f docker-compose.yaml pull
${privilege}docker compose -f docker-compose.yaml up -d --remove-orphans
${privilege}docker compose -f docker-compose.yaml ps
rm -rf '$stage'
"@
Invoke-Native "ssh" @("-p", "$SshPort", $target, $remote)
Write-Host "Self-hosted LiveKit deployment completed. Run npm run livekit:self-hosted:preflight after DNS and TLS are ready."
