import type { MeetingReactionKind, MeetingRole } from "./meeting";

export const MEETING_REACTION_KINDS = ["thumbs_up","heart","celebrate","laugh","surprised","clap"] as const satisfies readonly MeetingReactionKind[];
export type MeetingHandSignalAction = "raise"|"lower"|"acknowledge"|"request_stage"|"cancel_stage"|"approve_stage"|"deny_stage";
export type MeetingStageRequestStatus = "none"|"requested"|"approved"|"denied"|"cancelled";
export type MeetingReactionSignal = Readonly<{schemaVersion:1;eventId:string;roomId:string;sessionId:string;kind:MeetingReactionKind;sentAt:string;expiresAt:string}>;
export type AuthenticatedMeetingReaction = MeetingReactionSignal & Readonly<{senderIdentity:string;receivedAt:string;isLocal:boolean}>;
export type MeetingHandQueueEntry = Readonly<{participantId:string;userId:string|null;displayName:string;meetingRole:MeetingRole;handRaised:boolean;handRaisedAt:string|null;handSequence:number;acknowledgedByUserId:string|null;acknowledgedAt:string|null;stageRequestStatus:MeetingStageRequestStatus;stageRequestedAt:string|null;stageResolvedAt:string|null;stageResolvedByUserId:string|null;serverVersion:number;updatedAt:string}>;
export type MeetingHandQueueSnapshot = Readonly<{schemaVersion:1;roomId:string;sessionId:string;sessionSequence:number;generatedAt:string;entries:readonly MeetingHandQueueEntry[]}>;
