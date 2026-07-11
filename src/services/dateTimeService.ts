import type { DateStylePreference, TimeFormatPreference, UiLanguage } from "./settingsService";

type DateTimeInput = string | number | Date | null | undefined;
type DateTimeFormatOptions = Readonly<{ locale?: string; timeZone?: string; now?: Date }>;
type DateTimePreferences = Readonly<{ language: UiLanguage; dateStyle: DateStylePreference; timeFormat: TimeFormatPreference }>;

const neutralFallback = "\u2014";
let preferences: DateTimePreferences = { language: "en", dateStyle: "system", timeFormat: "system" };

function getLocale(locale?: string): string | undefined {
  const candidate = locale
    ?? (preferences.language === "tr" ? "tr-TR" : preferences.language === "en" ? "en-US" : undefined)
    ?? (typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language : undefined);
  if (!candidate) return undefined;
  try { return new Intl.DateTimeFormat(candidate).resolvedOptions().locale; } catch { return undefined; }
}

function parseDate(value: DateTimeInput): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withTimePreference(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  if (preferences.timeFormat === "12h") return { ...options, hour12: true };
  if (preferences.timeFormat === "24h") return { ...options, hour12: false };
  return options;
}

function compactDateOptions(): Intl.DateTimeFormatOptions {
  if (preferences.dateStyle === "numeric") return { year: "numeric", month: "2-digit", day: "2-digit" };
  if (preferences.dateStyle === "descriptive") return { year: "numeric", month: "long", day: "numeric" };
  return { month: "short", day: "numeric" };
}

function formatWith(value: DateTimeInput, options: Intl.DateTimeFormatOptions, formatOptions: DateTimeFormatOptions = {}): string {
  const date = parseDate(value);
  if (!date) return neutralFallback;
  const resolved = withTimePreference(options);
  try {
    return new Intl.DateTimeFormat(getLocale(formatOptions.locale), { ...resolved, timeZone: formatOptions.timeZone }).format(date);
  } catch {
    try { return new Intl.DateTimeFormat(getLocale(formatOptions.locale), resolved).format(date); } catch { return neutralFallback; }
  }
}

function getRelativeUnit(deltaMs: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absMs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < minute) return { value: Math.round(deltaMs / 1000), unit: "second" };
  if (absMs < hour) return { value: Math.round(deltaMs / minute), unit: "minute" };
  if (absMs < day) return { value: Math.round(deltaMs / hour), unit: "hour" };
  return { value: Math.round(deltaMs / day), unit: "day" };
}

export const dateTimeService = {
  parseDate,
  configure(next: DateTimePreferences): void { preferences = { ...next }; },
  getPreferences(): DateTimePreferences { return { ...preferences }; },

  formatMessageTime(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { hour: "2-digit", minute: "2-digit" }, options);
  },
  formatCompactDateTime(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { ...compactDateOptions(), hour: "2-digit", minute: "2-digit" }, options);
  },
  formatFullTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    const date = preferences.dateStyle === "numeric"
      ? { year: "numeric" as const, month: "2-digit" as const, day: "2-digit" as const }
      : { year: "numeric" as const, month: preferences.dateStyle === "descriptive" ? "long" as const : "short" as const, day: "numeric" as const };
    return formatWith(value, { ...date, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }, options);
  },
  formatRelativeTime(value: DateTimeInput, options: DateTimeFormatOptions = {}): string {
    const date = parseDate(value);
    if (!date) return neutralFallback;
    const { value: relativeValue, unit } = getRelativeUnit(date.getTime() - (options.now ?? new Date()).getTime());
    try { return new Intl.RelativeTimeFormat(getLocale(options.locale), { numeric: "auto" }).format(relativeValue, unit); } catch { return neutralFallback; }
  },
  formatEventDay(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { weekday: "long", ...compactDateOptions() }, options);
  },
  formatEventTime(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }, options);
  },
  getCalendarDayKey(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    const date = parseDate(value);
    if (!date) return "invalid";
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: options?.timeZone }).formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
      return part("year") + "-" + part("month") + "-" + part("day");
    } catch { return date.toISOString().slice(0, 10); }
  },
  formatAuditTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string { return this.formatFullTimestamp(value, options); },
  formatNotificationTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string { return this.formatRelativeTime(value, options); },
  formatEventRange(start: DateTimeInput, end?: DateTimeInput, options?: DateTimeFormatOptions): string {
    const startDate = parseDate(start);
    if (!startDate) return neutralFallback;
    const endDate = parseDate(end);
    if (!endDate) return this.formatCompactDateTime(startDate, options);
    try {
      const formatter = new Intl.DateTimeFormat(getLocale(options?.locale), withTimePreference({ ...compactDateOptions(), hour: "2-digit", minute: "2-digit", timeZone: options?.timeZone }));
      return formatter.format(startDate) + " - " + formatter.format(endDate);
    } catch {
      return this.formatCompactDateTime(startDate, { locale: options?.locale }) + " - " + this.formatCompactDateTime(endDate, { locale: options?.locale });
    }
  },
};
