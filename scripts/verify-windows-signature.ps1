param(
  [Parameter(Mandatory = $false)][string]$Path,
  [Parameter(Mandatory = $false)][string]$ExpectedPublisher,
  [switch]$Smoke
)

$ErrorActionPreference = 'Stop'

if ($Smoke) {
  $required = @('docs/release/windows-code-signing-final.md', 'electron-builder.yml', '.github/workflows/windows-signed-release.yml')
  foreach ($item in $required) { if (-not (Test-Path -LiteralPath $item)) { throw "Missing Windows signing control: $item" } }
  $builder = Get-Content -LiteralPath 'electron-builder.yml' -Raw
  if ($builder -match '(?m)^\s*(certificateFile|certificatePassword):') { throw 'Active certificate path/password must not be committed.' }
  Write-Output 'Windows signing control smoke passed. No certificate was loaded.'
  exit 0
}

if ($env:OS -ne 'Windows_NT') { throw 'Authenticode verification must run on Windows.' }
if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Pass -Path for the signed Windows installer.' }
if ([string]::IsNullOrWhiteSpace($ExpectedPublisher)) { throw 'Pass the approved publisher subject through protected release configuration.' }

$files = @(Resolve-Path -Path $Path -ErrorAction Stop)
if ($files.Count -eq 0) { throw 'No Windows artifact matched the requested path.' }

foreach ($file in $files) {
  $signature = Get-AuthenticodeSignature -FilePath $file.Path
  if ($signature.Status -ne 'Valid') { throw "Signature is not valid for $($file.Path): $($signature.Status)" }
  if ($null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Subject -notlike "*$ExpectedPublisher*") { throw "Publisher mismatch for $($file.Path)." }
  if ($null -eq $signature.TimeStamperCertificate) { throw "Trusted timestamp evidence is missing for $($file.Path)." }
  Write-Output "PASS signed artifact: $($file.Path)"
  Write-Output "Publisher: $($signature.SignerCertificate.Subject)"
  Write-Output "Timestamp subject: $($signature.TimeStamperCertificate.Subject)"
}
