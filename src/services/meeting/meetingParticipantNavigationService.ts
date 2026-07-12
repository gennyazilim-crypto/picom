export type MeetingParticipantNavigationRequest = Readonly<{
  action: "profile" | "direct_message";
  userId: string;
}>;

const EVENT_NAME = "picom:meeting-participant-navigation";

function dispatch(request: MeetingParticipantNavigationRequest): boolean {
  if (!request.userId.trim() || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent<MeetingParticipantNavigationRequest>(EVENT_NAME, { detail: request }));
  return true;
}

export const meetingParticipantNavigationService = {
  openProfile(userId: string): boolean {
    return dispatch({ action: "profile", userId });
  },
  openDirectMessage(userId: string): boolean {
    return dispatch({ action: "direct_message", userId });
  },
  subscribe(listener: (request: MeetingParticipantNavigationRequest) => void): () => void {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<MeetingParticipantNavigationRequest>).detail;
      if (detail?.userId && (detail.action === "profile" || detail.action === "direct_message")) listener(detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  },
};
