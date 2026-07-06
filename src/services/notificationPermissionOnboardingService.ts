import { notificationService, type NotificationPermissionState } from "./notificationService";

export type NotificationPermissionOnboardingTrigger =
  | "community_created"
  | "first_message_sent"
  | "notification_settings_opened";

export type NotificationPermissionPrompt = Readonly<{
  trigger: NotificationPermissionOnboardingTrigger;
  title: string;
  body: string;
  benefits: readonly string[];
}>;

type StoredNotificationPermissionOnboarding = Readonly<{
  schemaVersion: 1;
  dismissed: boolean;
  prompted: boolean;
  promptedAt?: string;
  dismissedAt?: string;
  lastTrigger?: NotificationPermissionOnboardingTrigger;
  lastPermission?: NotificationPermissionState;
}>;

const STORAGE_KEY = "picom.notificationPermissionOnboarding.v1";
const defaults: StoredNotificationPermissionOnboarding = {
  schemaVersion: 1,
  dismissed: false,
  prompted: false,
};

const promptCopy: Record<NotificationPermissionOnboardingTrigger, NotificationPermissionPrompt> = {
  community_created: {
    trigger: "community_created",
    title: "Stay close to important Picom updates",
    body: "Picom can notify you about mentions, direct message placeholders, and important community activity after you start using a workspace.",
    benefits: ["Mentions", "Direct messages placeholder", "Important updates"],
  },
  first_message_sent: {
    trigger: "first_message_sent",
    title: "Turn on desktop notifications?",
    body: "You sent your first message. Enable notifications when you want Picom to surface mentions and important replies while you work elsewhere.",
    benefits: ["Mentions", "Direct messages placeholder", "Important updates"],
  },
  notification_settings_opened: {
    trigger: "notification_settings_opened",
    title: "Enable notification permission",
    body: "Notifications are optional. You can allow them now or keep using Picom without desktop alerts.",
    benefits: ["Mentions", "Direct messages placeholder", "Important updates"],
  },
};

function normalizeState(value: Partial<StoredNotificationPermissionOnboarding> | null | undefined): StoredNotificationPermissionOnboarding {
  return {
    ...defaults,
    ...value,
    schemaVersion: 1,
    dismissed: typeof value?.dismissed === "boolean" ? value.dismissed : defaults.dismissed,
    prompted: typeof value?.prompted === "boolean" ? value.prompted : defaults.prompted,
  };
}

function readState(): StoredNotificationPermissionOnboarding {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredNotificationPermissionOnboarding>;
    return normalizeState(parsed.schemaVersion === 1 ? parsed : null);
  } catch {
    return defaults;
  }
}

function writeState(next: StoredNotificationPermissionOnboarding): StoredNotificationPermissionOnboarding {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Permission onboarding is best-effort and must never block the app.
  }

  return next;
}

function canPrompt(): boolean {
  const state = readState();
  if (state.dismissed || state.prompted) return false;

  const status = notificationService.getStatus();
  return status.supported && status.permission === "default";
}

export const notificationPermissionOnboardingService = {
  getState(): StoredNotificationPermissionOnboarding {
    return readState();
  },

  getPrompt(trigger: NotificationPermissionOnboardingTrigger): NotificationPermissionPrompt | null {
    if (!canPrompt()) return null;
    return promptCopy[trigger];
  },

  markPrompted(trigger: NotificationPermissionOnboardingTrigger): StoredNotificationPermissionOnboarding {
    return writeState({
      ...readState(),
      schemaVersion: 1,
      prompted: true,
      promptedAt: new Date().toISOString(),
      lastTrigger: trigger,
    });
  },

  dismiss(trigger?: NotificationPermissionOnboardingTrigger): StoredNotificationPermissionOnboarding {
    const state = readState();
    return writeState({
      ...state,
      schemaVersion: 1,
      dismissed: true,
      dismissedAt: new Date().toISOString(),
      lastTrigger: trigger ?? state.lastTrigger,
    });
  },

  markPermissionRequested(permission: NotificationPermissionState, trigger?: NotificationPermissionOnboardingTrigger): StoredNotificationPermissionOnboarding {
    const state = readState();
    return writeState({
      ...state,
      schemaVersion: 1,
      dismissed: true,
      dismissedAt: new Date().toISOString(),
      lastPermission: permission,
      lastTrigger: trigger ?? state.lastTrigger,
    });
  },

  reset(): StoredNotificationPermissionOnboarding {
    return writeState(defaults);
  },
};

