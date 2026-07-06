import { handleCorsPreflight } from "../_shared/cors.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";

function readPublicEnv(name: string, fallback = ""): string {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readReleaseChannel(): "dev" | "beta" | "stable" {
  const value = readPublicEnv("PICOM_RELEASE_CHANNEL", "dev");
  return value === "beta" || value === "stable" ? value : "dev";
}

function readMaxUploadBytes(): number {
  const value = Number(readPublicEnv("PICOM_MAX_UPLOAD_BYTES", "10485760"));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 50 * 1024 * 1024) : 10 * 1024 * 1024;
}

function readPublicBooleanEnv(name: string, fallback = false): boolean {
  const value = readPublicEnv(name, fallback ? "true" : "false").toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "enabled" || value === "yes";
}

Deno.serve((request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "GET") {
    return methodNotAllowed(["GET", "OPTIONS"]);
  }

  return jsonResponse({
    minimumSupportedVersion: readPublicEnv("PICOM_MINIMUM_SUPPORTED_VERSION", "0.1.0"),
    recommendedClientVersion: readPublicEnv("PICOM_RECOMMENDED_CLIENT_VERSION", "0.1.0"),
    latestVersion: readPublicEnv("PICOM_LATEST_VERSION", "0.1.0"),
    releaseChannel: readReleaseChannel(),
    featureFlags: {
      enableRealtime: true,
      enableVoiceRooms: true,
      enableDirectMessages: false,
      enableFriends: false,
      enableDiscovery: false,
      enableBots: false,
      enableWebhooks: false,
      enableThreads: false,
      enablePolls: false,
      enableAdvancedModeration: false,
      enableDiagnostics: false,
      enableAutoUpdate: false,
      enableAnalyticsPlaceholder: false,
      enableDeveloperPortal: false,
      enableCustomEmoji: false,
      enableStickers: false,
      enableForumChannels: false,
      enableAnnouncementChannels: false,
      enableSavedMessages: false,
    },
    killSwitches: {
      disableRealtime: readPublicBooleanEnv("PICOM_DISABLE_REALTIME"),
      disableUploads: readPublicBooleanEnv("PICOM_DISABLE_UPLOADS"),
      disableVoiceRooms: readPublicBooleanEnv("PICOM_DISABLE_VOICE_ROOMS"),
      disableDiscovery: readPublicBooleanEnv("PICOM_DISABLE_DISCOVERY"),
      disableWebhooks: readPublicBooleanEnv("PICOM_DISABLE_WEBHOOKS"),
      disableBots: readPublicBooleanEnv("PICOM_DISABLE_BOTS"),
      disableNativeNotifications: readPublicBooleanEnv("PICOM_DISABLE_NATIVE_NOTIFICATIONS"),
      disableAutoUpdate: readPublicBooleanEnv("PICOM_DISABLE_AUTO_UPDATE"),
      disableMessageEditing: readPublicBooleanEnv("PICOM_DISABLE_MESSAGE_EDITING"),
      disableInvites: readPublicBooleanEnv("PICOM_DISABLE_INVITES"),
    },
    maintenance: {
      status: readPublicEnv("PICOM_MAINTENANCE_STATUS", "operational"),
      message: readPublicEnv("PICOM_MAINTENANCE_MESSAGE", "Picom services are operating normally."),
    },
    uploadLimits: {
      maxUploadBytes: readMaxUploadBytes(),
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    },
    urls: {
      statusPageUrl: readPublicEnv("PICOM_STATUS_PAGE_URL"),
      supportUrl: readPublicEnv("PICOM_SUPPORT_URL"),
      docsUrl: readPublicEnv("PICOM_DOCS_URL"),
    },
  });
});
