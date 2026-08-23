import type { UpcomingEvent } from "../../../types/events";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format a Date as UTC ICS timestamp: YYYYMMDDTHHMMSSZ */
export function toIcsUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildEventIcs(event: UpcomingEvent, eventUrl: string): string {
  const starts = new Date(event.startsAt);
  const ends = event.endsAt ? new Date(event.endsAt) : new Date(starts.getTime() + 60 * 60 * 1000);
  const uid = `${event.id}@picom.gg`;
  const stamp = toIcsUtc(new Date());
  const location = event.locationType === "physical"
    ? String(event.locationData?.address ?? event.locationData?.venueName ?? "")
    : event.externalMeetingUrl ?? event.locationType ?? "";
  const description = [event.shortDescription, event.description].filter(Boolean).join("\\n\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PICOM//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(starts)}`,
    `DTEND:${toIcsUtc(ends)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    `URL:${eventUrl}`,
    event.createdBy ? `ORGANIZER:CN=PICOM:MAILTO:info@picom.gg` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function googleCalendarUrl(event: UpcomingEvent, eventUrl: string): string {
  const starts = toIcsUtc(new Date(event.startsAt)).replace(/Z$/, "");
  const ends = toIcsUtc(new Date(event.endsAt ?? new Date(Date.parse(event.startsAt) + 3600000))).replace(/Z$/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${starts}/${ends}`,
    details: `${event.shortDescription ?? event.description ?? ""}\n${eventUrl}`,
    location: String(event.locationData?.address ?? event.externalMeetingUrl ?? ""),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: UpcomingEvent, eventUrl: string): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt ?? new Date(Date.parse(event.startsAt) + 3600000)).toISOString(),
    body: `${event.shortDescription ?? event.description ?? ""}\n${eventUrl}`,
    location: String(event.locationData?.address ?? event.externalMeetingUrl ?? ""),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadIcsFile(event: UpcomingEvent, eventUrl: string): void {
  const ics = buildEventIcs(event, eventUrl);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `picom-event-${event.id}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
