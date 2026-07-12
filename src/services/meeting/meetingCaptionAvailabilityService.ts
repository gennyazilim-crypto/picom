import type { MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingCaptionSnapshot } from "../../types/meetingCaptions";

export type MeetingCaptionAvailability = Readonly<{ configured: boolean; allowed: boolean; visible: boolean }>;

export const meetingCaptionAvailabilityService = {
  getAvailability(snapshot: MeetingClientSnapshot, caption:MeetingCaptionSnapshot): MeetingCaptionAvailability {
    const configured = caption.configured;
    const allowed = snapshot.capabilities.canStartCaptions;
    const lifecycleVisible=!['idle','unavailable','stopped'].includes(caption.status)||caption.consentRequired;
    return { configured, allowed, visible: configured&&(allowed||lifecycleVisible) };
  },
};
