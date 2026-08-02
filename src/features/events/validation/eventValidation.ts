import type { CreateEventInput, EventLocationType, EventVisibility } from "../../../types/events";

const TITLE_MAX = 120;
const SHORT_MAX = 280;
const DESC_MAX = 5000;

export type EventValidationIssue = Readonly<{ field: string; message: string }>;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateCreateEventInput(input: CreateEventInput, now = new Date()): EventValidationIssue[] {
  const issues: EventValidationIssue[] = [];
  const title = input.title?.trim() ?? "";
  if (!title) issues.push({ field: "title", message: "Title is required." });
  if (title.length > TITLE_MAX) issues.push({ field: "title", message: `Title must be at most ${TITLE_MAX} characters.` });

  if (input.shortDescription && input.shortDescription.length > SHORT_MAX) {
    issues.push({ field: "shortDescription", message: `Short description must be at most ${SHORT_MAX} characters.` });
  }
  if (input.description && input.description.length > DESC_MAX) {
    issues.push({ field: "description", message: `Description must be at most ${DESC_MAX} characters.` });
  }

  const starts = Date.parse(input.startsAt);
  if (!Number.isFinite(starts)) issues.push({ field: "startsAt", message: "Start time is required." });
  else if (starts < now.getTime() - 5 * 60 * 1000) {
    issues.push({ field: "startsAt", message: "Start time cannot be in the past." });
  }

  if (input.endsAt) {
    const ends = Date.parse(input.endsAt);
    if (!Number.isFinite(ends)) issues.push({ field: "endsAt", message: "End time is invalid." });
    else if (Number.isFinite(starts) && ends <= starts) {
      issues.push({ field: "endsAt", message: "End time must be after start time." });
    }
  }

  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    issues.push({ field: "capacity", message: "Capacity must be a positive integer, or leave empty for unlimited." });
  }

  if (input.externalMeetingUrl && !isHttpsUrl(input.externalMeetingUrl)) {
    issues.push({ field: "externalMeetingUrl", message: "Meeting URL must use http or https." });
  }

  const visibility = input.visibility as EventVisibility | undefined;
  if (visibility && !["public", "followers", "community_only", "private", "secret"].includes(visibility)) {
    issues.push({ field: "visibility", message: "Visibility is invalid." });
  }

  const locationType = input.locationType as EventLocationType | undefined;
  if (locationType === "physical") {
    const venue = String(input.locationData?.venueName ?? "").trim();
    if (!venue) issues.push({ field: "locationData.venueName", message: "Venue name is required for physical events." });
  }

  if (input.ageLimit != null && (input.ageLimit < 13 || input.ageLimit > 99)) {
    issues.push({ field: "ageLimit", message: "Age limit must be between 13 and 99." });
  }

  return issues;
}

export function sanitizeEventText(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

export function normalizeInviteEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}
