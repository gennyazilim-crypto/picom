import type { MeetingRole } from "./meeting";

export type MeetingHistoryScope="community"|"mine";
export type MeetingHistoryStatus="upcoming"|"live"|"ended"|"failed";
export type MeetingAttendanceFinalState="left"|"removed"|"disconnected"|"ended";

export type MeetingAttendanceSummary=Readonly<{role:MeetingRole;joinedAt:string;leftAt:string|null;durationSeconds:number|null;reconnectCount:number;finalState:MeetingAttendanceFinalState}>;
export type MeetingAttendanceItem=MeetingAttendanceSummary&Readonly<{userId:string|null;displayName:string;avatarUrl:string|null}>;

export type MeetingHistoryItem=Readonly<{
  roomId:string;sessionId:string|null;communityId:string;channelId:string|null;title:string;mode:"voice"|"meeting"|"stage";status:MeetingHistoryStatus;
  scheduledFor:string|null;startedAt:string|null;endedAt:string|null;durationSeconds:number|null;hostUserId:string;hostName:string;attendanceCount:number;myAttendance:MeetingAttendanceSummary|null;
  outcomeCode:"provider_ended"|"host_ended"|"failed"|"cancelled"|"unknown"|null;outcomeVerified:boolean;outcomeVerifiedAt:string|null;
  hasDurableChat:boolean;captionsUsed:boolean;transcriptRetained:false;recordingAvailable:false;
}>;

export type MeetingHistoryPage=Readonly<{items:readonly MeetingHistoryItem[];upcoming:readonly MeetingHistoryItem[];scope:MeetingHistoryScope;canViewAttendance:boolean;transcriptRetention:"ephemeral_none"}>;
export type MeetingAttendancePage=Readonly<{sessionId:string;canViewAll:boolean;items:readonly MeetingAttendanceItem[]}>;
