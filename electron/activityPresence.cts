import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ActivityKind = "none" | "game" | "music";

export type ActivitySnapshot = Readonly<{
  kind: ActivityKind;
  statusText: string | null;
  source: string | null;
  title: string | null;
  detail: string | null;
  supported: boolean;
}>;

/** Process-name fragments → display label. Keys must be lowercase. */
const GAME_ALIASES: ReadonlyArray<Readonly<{ match: string; label: string }>> = Object.freeze([
  { match: "valorant-win64-shipping", label: "Valorant" },
  { match: "valorant", label: "Valorant" },
  { match: "leagueclientux", label: "League of Legends" },
  { match: "league of legends", label: "League of Legends" },
  { match: "cs2", label: "Counter-Strike 2" },
  { match: "csgo", label: "Counter-Strike" },
  { match: "r5apex", label: "Apex Legends" },
  { match: "fortniteclient-win64-shipping", label: "Fortnite" },
  { match: "fortnite", label: "Fortnite" },
  { match: "rocketleague", label: "Rocket League" },
  { match: "gta5", label: "GTA V" },
  { match: "gtav", label: "GTA V" },
  { match: "minecraft", label: "Minecraft" },
  { match: "javaw", label: "Minecraft" },
  { match: "overwatch", label: "Overwatch" },
  { match: "destiny2", label: "Destiny 2" },
  { match: "wowclassic", label: "World of Warcraft" },
  { match: "wow", label: "World of Warcraft" },
  { match: "dota2", label: "Dota 2" },
  { match: "genshinimpact", label: "Genshin Impact" },
  { match: "starrail", label: "Honkai: Star Rail" },
  { match: "modernwarfare", label: "Call of Duty" },
  { match: "cod", label: "Call of Duty" },
  { match: "fc26", label: "EA FC 26" },
  { match: "fc25", label: "EA FC 25" },
  { match: "fifa", label: "EA FC" },
  { match: "robloxplayerbeta", label: "Roblox" },
  { match: "eldenring", label: "Elden Ring" },
  { match: "spotify", label: "Spotify" },
]);

const IGNORED_PROCESS = new Set([
  "picom",
  "electron",
  "explorer",
  "searchhost",
  "shellexperiencehost",
  "applicationframehost",
  "systemsettings",
  "textinputhost",
  "lockapp",
  "dwm",
  "taskmgr",
  "cmd",
  "powershell",
  "windowsterminal",
  "code",
  "cursor",
  "chrome",
  "msedge",
  "firefox",
]);

function emptySnapshot(supported: boolean): ActivitySnapshot {
  return { kind: "none", statusText: null, source: null, title: null, detail: null, supported };
}

function formatMusicStatus(title: string, artist: string | null): string {
  const cleanTitle = title.trim();
  const cleanArtist = artist?.trim() || "";
  if (cleanArtist && cleanTitle) return `${cleanArtist} — ${cleanTitle} dinliyor`;
  if (cleanTitle) return `${cleanTitle} dinliyor`;
  if (cleanArtist) return `${cleanArtist} dinliyor`;
  return "Müzik dinliyor";
}

function formatGameStatus(name: string): string {
  return `${name.trim()} oynuyor`;
}

function resolveGameName(processName: string, windowTitle = ""): string | null {
  const key = processName.replace(/\.exe$/i, "").trim().toLowerCase();
  if (!key || IGNORED_PROCESS.has(key)) return null;

  for (const alias of GAME_ALIASES) {
    if (alias.match === "spotify") continue;
    if (key === alias.match || key.includes(alias.match)) return alias.label;
  }

  const title = windowTitle.trim();
  if (/valorant/i.test(title)) return "Valorant";
  if (/league of legends/i.test(title)) return "League of Legends";
  if (/counter-strike/i.test(title)) return "Counter-Strike 2";
  if (/fortnite/i.test(title)) return "Fortnite";
  if (/minecraft/i.test(title)) return "Minecraft";

  return null;
}

function parseSpotifyTitle(title: string): { title: string; artist: string | null } | null {
  const cleaned = title.replace(/\s+-\s+Spotify$/i, "").trim();
  if (!cleaned || /^spotify$/i.test(cleaned)) return null;
  const parts = cleaned.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts.slice(0, -1).join(" - "), artist: parts[parts.length - 1] };
  return { title: cleaned, artist: null };
}

function parseYouTubeTitle(title: string): { title: string; artist: string | null } | null {
  const cleaned = title
    .replace(/\s+-\s+YouTube(\s+Music)?\s+-\s+.+$/i, "")
    .replace(/\s+·\s+YouTube(\s+Music)?$/i, "")
    .trim();
  if (!cleaned) return null;
  return { title: cleaned, artist: null };
}

type RawProbe = Readonly<{
  foreground?: Readonly<{ processName?: string; title?: string }>;
  processes?: ReadonlyArray<string>;
  media?: Readonly<{ title?: string; artist?: string; app?: string; playing?: boolean }> | null;
}>;

async function probeWindowsActivity(): Promise<RawProbe> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PicomFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$hwnd = [PicomFg]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][PicomFg]::GetWindowText($hwnd, $sb, $sb.Capacity)
$procId = 0
[void][PicomFg]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
$fg = @{ processName = [string]$proc.ProcessName; title = [string]$sb.ToString() }
$known = @('valorant','valorant-win64-shipping','leagueclientux','cs2','csgo','r5apex','fortniteclient-win64-shipping','rocketleague','gta5','gtav','minecraft','javaw','overwatch','destiny2','wow','wowclassic','dota2','genshinimpact','starrail','cod','modernwarfare','fifa','fc25','fc26','robloxplayerbeta','eldenring','spotify')
$running = @(Get-Process | ForEach-Object { $_.ProcessName.ToLowerInvariant() } | Where-Object { $_ -in $known } | Select-Object -Unique)
$media = $null
try {
  $asTask = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]::RequestAsync()
  $manager = $asTask.GetAwaiter().GetResult()
  $session = $manager.GetCurrentSession()
  if ($session -ne $null) {
    $propsTask = $session.TryGetMediaPropertiesAsync()
    $props = $propsTask.GetAwaiter().GetResult()
    $info = $session.GetPlaybackInfo()
    $playing = [int]$info.PlaybackStatus -eq 4
    if ($playing -and $props -ne $null -and [string]$props.Title) {
      $media = @{
        title = [string]$props.Title
        artist = [string]$props.Artist
        app = [string]$session.SourceAppUserModelId
        playing = $true
      }
    }
  }
} catch {}
@{ foreground = $fg; processes = $running; media = $media } | ConvertTo-Json -Compress
`.trim();

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout: 5000, maxBuffer: 256 * 1024 },
  );
  const raw = String(stdout ?? "").trim();
  if (!raw) return {};
  return JSON.parse(raw) as RawProbe;
}

function buildSnapshot(probe: RawProbe): ActivitySnapshot {
  const media = probe.media;
  if (media?.playing && media.title?.trim()) {
    return {
      kind: "music",
      statusText: formatMusicStatus(media.title, media.artist ?? null),
      source: media.app?.trim() || "media",
      title: media.title.trim(),
      detail: media.artist?.trim() || null,
      supported: true,
    };
  }

  const processName = probe.foreground?.processName?.trim() || "";
  const windowTitle = probe.foreground?.title?.trim() || "";

  if (/spotify/i.test(processName) || /spotify/i.test(windowTitle)) {
    const parsed = parseSpotifyTitle(windowTitle);
    if (parsed) {
      return {
        kind: "music",
        statusText: formatMusicStatus(parsed.title, parsed.artist),
        source: "Spotify",
        title: parsed.title,
        detail: parsed.artist,
        supported: true,
      };
    }
  }

  if (/youtube/i.test(windowTitle)) {
    const parsed = parseYouTubeTitle(windowTitle);
    if (parsed) {
      return {
        kind: "music",
        statusText: formatMusicStatus(parsed.title, parsed.artist),
        source: "YouTube",
        title: parsed.title,
        detail: null,
        supported: true,
      };
    }
  }

  const foregroundGame = resolveGameName(processName, windowTitle);
  if (foregroundGame) {
    return {
      kind: "game",
      statusText: formatGameStatus(foregroundGame),
      source: processName || foregroundGame,
      title: foregroundGame,
      detail: null,
      supported: true,
    };
  }

  // Picom is often foreground while checking status — also detect known games that are running.
  for (const running of probe.processes ?? []) {
    const gameName = resolveGameName(running);
    if (gameName) {
      return {
        kind: "game",
        statusText: formatGameStatus(gameName),
        source: running,
        title: gameName,
        detail: null,
        supported: true,
      };
    }
  }

  return emptySnapshot(true);
}

export async function getActivitySnapshot(platform: NodeJS.Platform): Promise<ActivitySnapshot> {
  if (platform !== "win32") return emptySnapshot(false);
  try {
    const probe = await probeWindowsActivity();
    return buildSnapshot(probe);
  } catch {
    return emptySnapshot(true);
  }
}
