import type { MeetingParticipantStateSnapshot } from "../../types/meetingParticipantState";
import type { MeetingWaitingEntry, MeetingWaitingRequestInput, MeetingWaitingRequestResult, MeetingWaitingServiceResult } from "../../types/meetingWaitingRoom";
import { meetingParticipantReconciliationService } from "./meetingParticipantReconciliationService";
import { meetingWaitingRoomRealtimeService } from "./meetingWaitingRoomRealtimeService";
import { meetingWaitingRoomService } from "./meetingWaitingRoomService";

export type MeetingRepositorySubscription = Readonly<{
  onParticipants?: (snapshot: MeetingParticipantStateSnapshot) => void;
  onWaitingEntry?: (entry: MeetingWaitingEntry) => void;
  onRealtimeStatus?: (status: "idle" | "connecting" | "connected" | "reconnecting" | "disconnected") => void;
  onError?: (message: string) => void;
}>;

export const meetingRepository = {
  loadParticipants: meetingParticipantReconciliationService.load,
  getMyWaitingEntry: meetingWaitingRoomService.getMine,
  requestWaitingRoom(input: MeetingWaitingRequestInput): Promise<MeetingWaitingServiceResult<MeetingWaitingRequestResult>> { return meetingWaitingRoomService.request(input); },
  seedMockParticipants(snapshot: MeetingParticipantStateSnapshot): void { meetingParticipantReconciliationService.seedMock(snapshot); },
  subscribe(roomId: string, sessionId: string, subscriber: MeetingRepositorySubscription): () => void {
    const cleanups: Array<() => void> = [];
    if (subscriber.onParticipants) cleanups.push(meetingParticipantReconciliationService.subscribe(roomId, sessionId, {
      onSnapshot: subscriber.onParticipants,
      onStatus: (status) => subscriber.onRealtimeStatus?.(status),
      onError: subscriber.onError,
    }));
    if (subscriber.onWaitingEntry) cleanups.push(meetingWaitingRoomRealtimeService.subscribe(roomId, {
      onEvent: (event) => subscriber.onWaitingEntry?.(event.entry),
      onStatus: (status) => subscriber.onRealtimeStatus?.(status),
      onError: subscriber.onError,
    }));
    return () => { for (const cleanup of cleanups) cleanup(); };
  },
};
