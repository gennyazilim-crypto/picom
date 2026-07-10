export type AnalyticsEventName = "app_started" | "login_success" | "community_created" | "message_sent_count_only" | "upload_success" | "upload_failure" | "voice_joined" | "voice_join_failure" | "screen_share_started" | "settings_opened" | "feature_usage_count_only";
export type AnalyticsFeatureName = "mention_feed" | "community_chat" | "direct_messages" | "friends" | "saved_messages" | "discovery" | "profile" | "voice" | "screen_share" | "settings";
export type AnalyticsEvent = Readonly<{ id: string; name: AnalyticsEventName; timestamp: string; metadata: Record<string, string | number | boolean> }>;
export type AnalyticsDashboardSnapshot = Readonly<{
  enabled: boolean;
  generatedAt: string;
  retainedEventCount: number;
  totals: Readonly<{ appStarts: number; messagesSent: number; uploadSuccesses: number; uploadFailures: number; voiceJoinFailures: number; featureUses: number }>;
}>;
const ENABLED_KEY = "picom.analytics.enabled.v1"; const QUEUE_KEY = "picom.analytics.localQueue.v1"; const SENSITIVE = /(message|body|password|token|secret|channel|attachment|email|username|user_id|session|authorization)/i;
const allowedMetadata: Record<AnalyticsEventName, readonly string[]> = { app_started: ["runtime", "releaseChannel"], login_success: ["mode"], community_created: ["mode"], message_sent_count_only: ["count", "mode"], upload_success: ["kind", "sizeBucket"], upload_failure: ["kind"], voice_joined: ["mode"], voice_join_failure: ["mode"], screen_share_started: ["mode"], settings_opened: ["section"], feature_usage_count_only: ["feature", "count"] };
const allowedFeatures = new Set<AnalyticsFeatureName>(["mention_feed", "community_chat", "direct_messages", "friends", "saved_messages", "discovery", "profile", "voice", "screen_share", "settings"]);
function readQueue(): AnalyticsEvent[] { try { const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as AnalyticsEvent[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function sanitize(name: AnalyticsEventName, metadata: Record<string, unknown>): Record<string, string | number | boolean> { const allow = new Set(allowedMetadata[name]); return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => allow.has(key) && !SENSITIVE.test(key) && ["string", "number", "boolean"].includes(typeof value) && (typeof value !== "number" || Number.isFinite(value)) && (key !== "feature" || (typeof value === "string" && allowedFeatures.has(value as AnalyticsFeatureName)))).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 40) : typeof value === "number" && key === "count" ? Math.min(Math.max(Math.trunc(value), 0), 10_000) : value as number | boolean])) as Record<string, string | number | boolean>; }
function countEvents(queue: AnalyticsEvent[], name: AnalyticsEventName): number { return queue.filter((event) => event.name === name).length; }
function sumCounts(queue: AnalyticsEvent[], name: AnalyticsEventName): number { return queue.filter((event) => event.name === name).reduce((total, event) => total + (typeof event.metadata.count === "number" ? event.metadata.count : 1), 0); }
export const analyticsService = {
  isEnabled(): boolean { try { return window.localStorage.getItem(ENABLED_KEY) === "true"; } catch { return false; } },
  setEnabled(enabled: boolean): boolean { try { window.localStorage.setItem(ENABLED_KEY, String(enabled)); if (!enabled) window.localStorage.removeItem(QUEUE_KEY); } catch { return false; } return enabled; },
  trackEvent(name: AnalyticsEventName, metadata: Record<string, unknown> = {}): AnalyticsEvent | null { if (!this.isEnabled()) return null; const event: AnalyticsEvent = { id: `analytics-${crypto.randomUUID()}`, name, timestamp: new Date().toISOString(), metadata: sanitize(name, metadata) }; try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...readQueue(), event].slice(-100))); } catch { return null; } return event; },
  trackFeatureUsage(feature: AnalyticsFeatureName, count = 1): AnalyticsEvent | null { return this.trackEvent("feature_usage_count_only", { feature, count }); },
  identifyUserPlaceholder(): { identified: false; reason: string } { return { identified: false, reason: "Picom analytics does not identify users in the placeholder implementation." }; },
  getLocalQueue(): AnalyticsEvent[] { return readQueue().map((event) => ({ ...event, metadata: { ...event.metadata } })); },
  getPrivacyDashboardSnapshot(): AnalyticsDashboardSnapshot { const queue = readQueue(); return { enabled: this.isEnabled(), generatedAt: new Date().toISOString(), retainedEventCount: queue.length, totals: { appStarts: countEvents(queue, "app_started"), messagesSent: sumCounts(queue, "message_sent_count_only"), uploadSuccesses: countEvents(queue, "upload_success"), uploadFailures: countEvents(queue, "upload_failure"), voiceJoinFailures: countEvents(queue, "voice_join_failure"), featureUses: sumCounts(queue, "feature_usage_count_only") } }; },
};
