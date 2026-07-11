import type { MeetingClientSnapshot } from "../../types/meetingClient";

export type MeetingCaptionAvailability = Readonly<{ configured: boolean; allowed: boolean; visible: boolean }>;

export const meetingCaptionAvailabilityService = {
  getAvailability(snapshot: MeetingClientSnapshot): MeetingCaptionAvailability {
    // Task 567 replaces this provider gate only after a consent-capable caption
    // backend is configured. Capability alone must never expose a fake tab.
    const configured = false;
    const allowed = snapshot.capabilities.canStartCaptions;
    return { configured, allowed, visible: configured && allowed };
  },
};
