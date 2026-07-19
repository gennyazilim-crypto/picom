param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$TargetPath = (Join-Path $PSScriptRoot "..\public\icons\iconix.svg")
)

$ErrorActionPreference = "Stop"

[xml]$sourceXml = Get-Content -LiteralPath $SourcePath -Raw
$sourceNodes = $sourceXml.DocumentElement.ChildNodes | Select-Object -Skip 1
$sourceMarkup = ($sourceNodes | ForEach-Object { $_.OuterXml }) -join [Environment]::NewLine
$sourceMarkup = $sourceMarkup.Replace('stroke="white"', 'stroke="currentColor"').Replace('fill="white"', 'fill="currentColor"')

$cropSymbols = @(
  @{ Id = "home"; X = 40; Y = 40 },
  @{ Id = "settings"; X = 720; Y = 80 },
  @{ Id = "search"; X = 480; Y = 80 },
  @{ Id = "bell"; X = 840; Y = 120 },
  @{ Id = "inbox"; X = 440; Y = 120 },
  @{ Id = "pin"; X = 120; Y = 40 },
  @{ Id = "users"; X = 760; Y = 80 },
  @{ Id = "voice"; X = 280; Y = 80 },
  @{ Id = "lock"; X = 80; Y = 40 },
  @{ Id = "chevron-right"; X = 880; Y = 160 },
  @{ Id = "send"; X = 880; Y = 40 },
  @{ Id = "image"; X = 40; Y = 120 },
  @{ Id = "smile"; X = 200; Y = 160 },
  @{ Id = "more"; X = 720; Y = 160 },
  @{ Id = "reply"; X = 760; Y = 160 },
  @{ Id = "edit"; X = 160; Y = 80 },
  @{ Id = "trash"; X = 520; Y = 120 },
  @{ Id = "close"; X = 240; Y = 160 },
  @{ Id = "user"; X = 440; Y = 40 },
  @{ Id = "microphone"; X = 280; Y = 80 },
  @{ Id = "moon"; X = 520; Y = 80 },
  @{ Id = "play"; X = 320; Y = 80 },
  @{ Id = "pause"; X = 360; Y = 80 }
)

$sourceSymbols = ($cropSymbols | ForEach-Object {
  '    <symbol id="iconix-{0}" viewBox="{1} {2} 24 24"><use href="#iconix-source" /></symbol>' -f $_.Id, $_.X, $_.Y
}) -join [Environment]::NewLine

$supplementalSymbols = @'
    <!-- Picom semantic controls drawn to Iconix's 24px / 1.5px rounded-stroke specification. -->
    <symbol id="iconix-plus" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></symbol>
    <symbol id="iconix-hash" viewBox="0 0 24 24"><path d="M9 4L7 20M17 4L15 20M4 9H20M3 15H19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></symbol>
    <symbol id="iconix-chevron-down" viewBox="0 0 24 24"><path d="M4.5 8.5L12 16L19.5 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    <symbol id="iconix-eye" viewBox="0 0 24 24"><path d="M2.75 12C4.85 7.9 8 5.75 12 5.75S19.15 7.9 21.25 12C19.15 16.1 16 18.25 12 18.25S4.85 16.1 2.75 12Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" stroke-width="1.5" /></symbol>
    <symbol id="iconix-minimize" viewBox="0 0 24 24"><path d="M5 12H19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></symbol>
    <symbol id="iconix-maximize" viewBox="0 0 24 24"><rect x="4.75" y="4.75" width="14.5" height="14.5" rx="2.25" fill="none" stroke="currentColor" stroke-width="1.5" /></symbol>
    <symbol id="iconix-headphones" viewBox="0 0 24 24"><path d="M4 13V11C4 6.58 7.58 3 12 3S20 6.58 20 11V13M4 13H6.25C7.22 13 8 13.78 8 14.75V18.25C8 19.22 7.22 20 6.25 20H5.75C4.78 20 4 19.22 4 18.25V13ZM20 13H17.75C16.78 13 16 13.78 16 14.75V18.25C16 19.22 16.78 20 17.75 20H18.25C19.22 20 20 19.22 20 18.25V13Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    <symbol id="iconix-paperclip" viewBox="0 0 24 24"><path d="M8.25 12.75L14.9 6.1C16.27 4.73 18.49 4.73 19.86 6.1C21.23 7.47 21.23 9.69 19.86 11.06L11.45 19.47C9.4 21.52 6.08 21.52 4.03 19.47C1.98 17.42 1.98 14.1 4.03 12.05L12.09 3.99M7.19 15.93L15.25 7.87" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    <symbol id="iconix-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.75" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M12 2.75V5M12 19V21.25M2.75 12H5M19 12H21.25M5.46 5.46L7.05 7.05M16.95 16.95L18.54 18.54M18.54 5.46L16.95 7.05M7.05 16.95L5.46 18.54" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></symbol>
    <symbol id="iconix-volume" viewBox="0 0 24 24"><path d="M4 9H7.5L12 5.25V18.75L7.5 15H4V9ZM15.5 9C16.45 9.75 17 10.75 17 12C17 13.25 16.45 14.25 15.5 15M17.75 6.75C19.2 8.1 20 9.85 20 12C20 14.15 19.2 15.9 17.75 17.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    <symbol id="iconix-volume-off" viewBox="0 0 24 24"><path d="M4 9H7.5L12 5.25V18.75L7.5 15H4V9ZM16 9L21 14M21 9L16 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    <symbol id="iconix-logout" viewBox="0 0 24 24"><path d="M10 5H6.75A2.75 2.75 0 0 0 4 7.75V16.25A2.75 2.75 0 0 0 6.75 19H10M14 8L18 12L14 16M18 12H9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
'@

$sprite = @"
<svg xmlns="http://www.w3.org/2000/svg">
  <!-- Iconix by Rijal. Exported from the user-provided Figma Community file. See THIRD_PARTY_NOTICES.md. -->
  <defs>
    <g id="iconix-source">
$sourceMarkup
    </g>
$sourceSymbols
$supplementalSymbols
  </defs>
</svg>
"@

$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)
New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedTarget) -Force | Out-Null
[System.IO.File]::WriteAllText($resolvedTarget, $sprite, [System.Text.UTF8Encoding]::new($false))
