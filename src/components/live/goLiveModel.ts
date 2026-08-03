import type { LiveScreenShareCategory } from "../../types/liveScreenShare";

export type GoLiveStepId = "context" | "source" | "details" | "visibility" | "preflight";

export const GO_LIVE_STEPS: readonly GoLiveStepId[] = [
  "context",
  "source",
  "details",
  "visibility",
  "preflight",
] as const;

export type GoLiveVisibilityMode = "channel_members" | "community_members" | "public_discovery";

export type GoLiveStartPhase =
  | "idle"
  | "preparing"
  | "authorizing"
  | "connecting"
  | "publishing"
  | "live"
  | "failed"
  | "permission_denied"
  | "rollback_required";

export type GoLivePreflightStatus = "checking" | "passed" | "warning" | "failed";

export type GoLivePreflightCheck = Readonly<{
  id: string;
  label: string;
  status: GoLivePreflightStatus;
  detail: string;
}>;

export type GoLiveDraft = Readonly<{
  communityId: string | null;
  channelId: string | null;
  communityName: string;
  channelName: string;
  communityVisibility: "public" | "private" | "secret" | string;
  channelPrivate: boolean;
  canPublishAudio: boolean;
  canPublishScreen: boolean;
  sourceId: string | null;
  sourceLabel: string;
  sourceType: "screen" | "window" | "browser" | null;
  includeSystemAudio: boolean | null;
  microphoneEnabled: boolean;
  microphoneDeviceId: string;
  cameraEnabled: boolean;
  cameraDeviceId: string;
  cameraMirror: boolean;
  title: string;
  description: string;
  category: LiveScreenShareCategory;
  applicationName: string;
  languageCode: string;
  visibilityMode: GoLiveVisibilityMode;
  policyAccepted: boolean;
  clientRequestId: string | null;
  scheduleEventId: string | null;
}>;

export const GO_LIVE_CATEGORIES: readonly Readonly<{ id: LiveScreenShareCategory; label: string }>[] = [
  { id: "game", label: "Gaming" },
  { id: "chat", label: "Just chatting" },
  { id: "watch_together", label: "Watch together" },
  { id: "education", label: "Education" },
  { id: "other", label: "Other" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function parseGoLiveRouteParams(search: string | URLSearchParams): Readonly<{
  communityId: string | null;
  channelId: string | null;
  scheduleEventId: string | null;
}> {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const communityRaw = params.get("community")?.trim() ?? "";
  const channelRaw = params.get("channel")?.trim() ?? "";
  const scheduleRaw = params.get("schedule")?.trim() ?? params.get("scheduleEventId")?.trim() ?? "";
  return {
    communityId: UUID_RE.test(communityRaw) ? communityRaw : null,
    channelId: UUID_RE.test(channelRaw) ? channelRaw : null,
    scheduleEventId: UUID_RE.test(scheduleRaw) ? scheduleRaw : null,
  };
}

export function createEmptyGoLiveDraft(seed?: Partial<GoLiveDraft>): GoLiveDraft {
  return {
    communityId: null,
    channelId: null,
    communityName: "",
    channelName: "",
    communityVisibility: "private",
    channelPrivate: false,
    canPublishAudio: false,
    canPublishScreen: false,
    sourceId: null,
    sourceLabel: "",
    sourceType: null,
    includeSystemAudio: null,
    microphoneEnabled: false,
    microphoneDeviceId: "default",
    cameraEnabled: false,
    cameraDeviceId: "default",
    cameraMirror: true,
    title: "",
    description: "",
    category: "other",
    applicationName: "",
    languageCode: "",
    visibilityMode: "channel_members",
    policyAccepted: false,
    clientRequestId: null,
    scheduleEventId: null,
    ...seed,
  };
}

export function sanitizeGoLiveText(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
}

export function validateGoLiveTitle(title: string): Readonly<{ ok: true; value: string } | { ok: false; message: string }> {
  const value = sanitizeGoLiveText(title, 160);
  if (!value) return { ok: false, message: "A stream title is required." };
  if (value.length > 160) return { ok: false, message: "Title must be 160 characters or fewer." };
  return { ok: true, value };
}

export function validateGoLiveDescription(description: string): Readonly<{ ok: true; value: string } | { ok: false; message: string }> {
  const value = sanitizeGoLiveText(description, 2000);
  if (value.length > 2000) return { ok: false, message: "Description must be 2000 characters or fewer." };
  return { ok: true, value };
}

export function allowedVisibilityModes(input: Readonly<{
  communityVisibility: string;
  channelPrivate: boolean;
}>): readonly GoLiveVisibilityMode[] {
  const modes: GoLiveVisibilityMode[] = ["channel_members"];
  if (!input.channelPrivate) modes.push("community_members");
  if (input.communityVisibility === "public" && !input.channelPrivate) {
    modes.push("public_discovery");
  }
  return modes;
}

export function visibilitySummary(draft: Pick<GoLiveDraft, "visibilityMode" | "communityName" | "channelName" | "channelPrivate" | "communityVisibility">): string {
  switch (draft.visibilityMode) {
    case "public_discovery":
      return `Members of ${draft.communityName || "this community"} who can access Live Now can discover this stream.`;
    case "community_members":
      return `Active members of ${draft.communityName || "this community"} who can join voice can see this stream.`;
    case "channel_members":
    default:
      return draft.channelPrivate
        ? `Only members who can access #${draft.channelName || "channel"} can see this stream.`
        : `Members who can access #${draft.channelName || "channel"} in ${draft.communityName || "this community"} can see this stream.`;
  }
}

export function canAdvanceFromStep(step: GoLiveStepId, draft: GoLiveDraft): Readonly<{ ok: true } | { ok: false; message: string }> {
  switch (step) {
    case "context":
      if (!draft.communityId || !draft.channelId) return { ok: false, message: "Choose a community and voice channel." };
      if (!draft.canPublishScreen) return { ok: false, message: "You do not have screen-share permission in this channel." };
      return { ok: true };
    case "source":
      if (!draft.sourceId) return { ok: false, message: "Select a screen or window source." };
      return { ok: true };
    case "details": {
      const title = validateGoLiveTitle(draft.title);
      if (!title.ok) return title;
      const description = validateGoLiveDescription(draft.description);
      if (!description.ok) return description;
      return { ok: true };
    }
    case "visibility": {
      const allowed = allowedVisibilityModes(draft);
      if (!allowed.includes(draft.visibilityMode)) {
        return { ok: false, message: "Selected visibility is not allowed for this community or channel." };
      }
      if (!draft.policyAccepted) return { ok: false, message: "Accept the live streaming policy to continue." };
      return { ok: true };
    }
    case "preflight":
      return { ok: true };
    default:
      return { ok: false, message: "Unknown step." };
  }
}

export function nextGoLiveStep(step: GoLiveStepId): GoLiveStepId | null {
  const index = GO_LIVE_STEPS.indexOf(step);
  if (index < 0 || index >= GO_LIVE_STEPS.length - 1) return null;
  return GO_LIVE_STEPS[index + 1] ?? null;
}

export function previousGoLiveStep(step: GoLiveStepId): GoLiveStepId | null {
  const index = GO_LIVE_STEPS.indexOf(step);
  if (index <= 0) return null;
  return GO_LIVE_STEPS[index - 1] ?? null;
}

export function reduceGoLiveStartPhase(
  phase: GoLiveStartPhase,
  event:
    | { type: "start" }
    | { type: "authorized" }
    | { type: "connected" }
    | { type: "published" }
    | { type: "confirmed" }
    | { type: "permission_denied" }
    | { type: "fail" }
    | { type: "rollback" }
    | { type: "reset" },
): GoLiveStartPhase {
  if (event.type === "reset") return "idle";
  switch (phase) {
    case "idle":
      return event.type === "start" ? "preparing" : phase;
    case "preparing":
      if (event.type === "permission_denied") return "permission_denied";
      if (event.type === "fail") return "failed";
      if (event.type === "authorized") return "authorizing";
      return phase;
    case "authorizing":
      if (event.type === "permission_denied") return "permission_denied";
      if (event.type === "fail") return "failed";
      if (event.type === "connected") return "connecting";
      return phase;
    case "connecting":
      if (event.type === "fail") return "failed";
      if (event.type === "published") return "publishing";
      return phase;
    case "publishing":
      if (event.type === "rollback") return "rollback_required";
      if (event.type === "fail") return "failed";
      if (event.type === "confirmed") return "live";
      return phase;
    default:
      return phase;
  }
}

export function evaluateGoLivePreflight(input: Readonly<{
  authenticated: boolean;
  canPublishScreen: boolean;
  publisherBroadcastAllowed: boolean | null;
  hasCommunityChannel: boolean;
  hasActiveSource: boolean;
  sourceEnded: boolean;
  microphoneDesired: boolean;
  microphoneReady: boolean | null;
  networkOnline: boolean;
  livekitReachable: boolean | null;
  conflict: boolean;
}>): readonly GoLivePreflightCheck[] {
  const checks: GoLivePreflightCheck[] = [
    {
      id: "auth",
      label: "Signed in",
      status: input.authenticated ? "passed" : "failed",
      detail: input.authenticated ? "Session is valid." : "Sign in to go live.",
    },
    {
      id: "publisher",
      label: "Creator/Publisher authorization",
      status: input.publisherBroadcastAllowed === null
        ? "checking"
        : input.publisherBroadcastAllowed
          ? "passed"
          : "failed",
      detail: input.publisherBroadcastAllowed === null
        ? "Checking Creator/Publisher eligibility…"
        : input.publisherBroadcastAllowed
          ? "Approved Creator/Publisher with active badge."
          : "Approved Creator/Publisher account with an active badge is required.",
    },
    {
      id: "context",
      label: "Community & channel",
      status: input.hasCommunityChannel ? "passed" : "failed",
      detail: input.hasCommunityChannel ? "Broadcast target selected." : "Select a community voice channel.",
    },
    {
      id: "permission",
      label: "Screen publish permission",
      status: input.canPublishScreen ? "passed" : "failed",
      detail: input.canPublishScreen ? "shareScreen granted." : "Missing shareScreen permission.",
    },
    {
      id: "conflict",
      label: "No conflicting stream",
      status: input.conflict ? "failed" : "passed",
      detail: input.conflict ? "Another active broadcast blocks start." : "No concurrent stream conflict detected.",
    },
    {
      id: "source",
      label: "Capture source",
      status: !input.hasActiveSource ? "failed" : input.sourceEnded ? "failed" : "passed",
      detail: !input.hasActiveSource
        ? "No screen source selected."
        : input.sourceEnded
          ? "Selected source ended. Choose again."
          : "Local source is active for preview.",
    },
    {
      id: "microphone",
      label: "Microphone",
      status: !input.microphoneDesired
        ? "passed"
        : input.microphoneReady === null
          ? "warning"
          : input.microphoneReady
            ? "passed"
            : "warning",
      detail: !input.microphoneDesired
        ? "Microphone will stay off."
        : input.microphoneReady === null
          ? "Permission not confirmed yet — stream can still start muted."
          : input.microphoneReady
            ? "Microphone ready."
            : "Microphone unavailable — stream can continue without mic.",
    },
    {
      id: "network",
      label: "Network",
      status: input.networkOnline ? "passed" : "failed",
      detail: input.networkOnline ? "Browser reports online." : "Device appears offline.",
    },
    {
      id: "livekit",
      label: "LiveKit authorization",
      status: input.livekitReachable === null ? "checking" : input.livekitReachable ? "passed" : "failed",
      detail: input.livekitReachable === null
        ? "Checking token endpoint…"
        : input.livekitReachable
          ? "Token endpoint reachable."
          : "Could not authorize LiveKit.",
    },
  ];
  return checks;
}

export function preflightBlocksStart(checks: readonly GoLivePreflightCheck[]): boolean {
  return checks.some((check) => check.status === "failed" || check.status === "checking");
}

export function systemAudioCapabilityLabel(input: Readonly<{
  platform: "electron" | "web" | "unknown";
  sourceType: GoLiveDraft["sourceType"];
  includeSystemAudio: boolean | null;
}>): string {
  if (input.platform === "electron") {
    return input.includeSystemAudio === true
      ? "System audio selected when the OS allows it for this source."
      : "System audio is limited on desktop capture; status depends on the selected source.";
  }
  if (input.platform === "web") {
    if (input.sourceType === "browser") {
      return input.includeSystemAudio === true
        ? "Tab/window audio was included by the browser picker."
        : input.includeSystemAudio === false
          ? "System/tab audio was not included."
          : "System audio availability depends on the browser picker choice.";
    }
    return "System audio is only available when the browser picker includes it.";
  }
  return "System audio capability could not be measured.";
}

const GO_LIVE_SETTINGS_KEY = "picom.go-live-preferences.v1";

export type GoLiveLocalSettings = Readonly<{
  microphoneEnabled: boolean;
  microphoneDeviceId: string;
  cameraEnabled: boolean;
  cameraDeviceId: string;
  category: LiveScreenShareCategory;
  languageCode: string;
}>;

export function loadGoLiveLocalSettings(): Partial<GoLiveLocalSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GO_LIVE_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<GoLiveLocalSettings>;
    return {
      microphoneEnabled: typeof parsed.microphoneEnabled === "boolean" ? parsed.microphoneEnabled : undefined,
      microphoneDeviceId: typeof parsed.microphoneDeviceId === "string" ? parsed.microphoneDeviceId.slice(0, 120) : undefined,
      cameraEnabled: typeof parsed.cameraEnabled === "boolean" ? parsed.cameraEnabled : undefined,
      cameraDeviceId: typeof parsed.cameraDeviceId === "string" ? parsed.cameraDeviceId.slice(0, 120) : undefined,
      category: GO_LIVE_CATEGORIES.some((item) => item.id === parsed.category) ? parsed.category : undefined,
      languageCode: typeof parsed.languageCode === "string" ? parsed.languageCode.slice(0, 16) : undefined,
    };
  } catch {
    return {};
  }
}

export function saveGoLiveLocalSettings(settings: GoLiveLocalSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GO_LIVE_SETTINGS_KEY,
      JSON.stringify({
        microphoneEnabled: settings.microphoneEnabled,
        microphoneDeviceId: settings.microphoneDeviceId.slice(0, 120),
        cameraEnabled: settings.cameraEnabled,
        cameraDeviceId: settings.cameraDeviceId.slice(0, 120),
        category: settings.category,
        languageCode: settings.languageCode.slice(0, 16),
      }),
    );
  } catch {
    /* ignore quota */
  }
}
