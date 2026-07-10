type DateTimeInput = string | number | Date | null | undefined;

type DateTimeFormatOptions = Readonly<{
  locale?: string;
  timeZone?: string;
  now?: Date;
}>;

function getLocale(locale?: string): string | undefined {
  const candidate = locale
    ?? (typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language : undefined);
  if (!candidate) return undefined;
  try {
    return new Intl.DateTimeFormat(candidate).resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

function parseDate(value: DateTimeInput): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWith(
  value: DateTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
  formatOptions: DateTimeFormatOptions = {},
): string {
  const date = parseDate(value);
  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(getLocale(formatOptions.locale), {
      ...options,
      timeZone: formatOptions.timeZone,
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(getLocale(formatOptions.locale), options).format(date);
    } catch {
      return fallback;
    }
  }
}

function getRelativeUnit(deltaMs: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absMs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return { value: Math.round(deltaMs / 1000), unit: "second" };
  }

  if (absMs < hour) {
    return { value: Math.round(deltaMs / minute), unit: "minute" };
  }

  if (absMs < day) {
    return { value: Math.round(deltaMs / hour), unit: "hour" };
  }

  return { value: Math.round(deltaMs / day), unit: "day" };
}

export const dateTimeService = {
  parseDate,

  formatMessageTime(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { hour: "2-digit", minute: "2-digit" }, "Invalid time", options);
  },

  formatCompactDateTime(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(value, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, "Invalid date", options);
  },

  formatFullTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return formatWith(
      value,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      },
      "Invalid date",
      options,
    );
  },

  formatRelativeTime(value: DateTimeInput, options: DateTimeFormatOptions = {}): string {
    const date = parseDate(value);
    if (!date) {
      return "Invalid date";
    }

    const now = options.now ?? new Date();
    const { value: relativeValue, unit } = getRelativeUnit(date.getTime() - now.getTime());
    try {
      return new Intl.RelativeTimeFormat(getLocale(options.locale), { numeric: "auto" }).format(relativeValue, unit);
    } catch {
      return "Invalid date";
    }
  },

  formatAuditTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return this.formatFullTimestamp(value, options);
  },

  formatNotificationTimestamp(value: DateTimeInput, options?: DateTimeFormatOptions): string {
    return this.formatRelativeTime(value, options);
  },

  formatEventRange(start: DateTimeInput, end?: DateTimeInput, options?: DateTimeFormatOptions): string {
    const startDate = parseDate(start);
    if (!startDate) {
      return "Invalid date";
    }

    const endDate = parseDate(end);
    if (!endDate) {
      return this.formatCompactDateTime(startDate, options);
    }

    try {
      const formatter = new Intl.DateTimeFormat(getLocale(options?.locale), {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: options?.timeZone,
      });
      return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
    } catch {
      return `${this.formatCompactDateTime(startDate, { locale: options?.locale })} - ${this.formatCompactDateTime(endDate, { locale: options?.locale })}`;
    }
  },
};
