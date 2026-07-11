import type { MeetingCapabilities, MeetingJoinPolicy, MeetingLayoutMode, MeetingRoomStatus } from "./meeting";

export type MeetingWorkspaceDestination = "voice_lounge" | "meeting" | "stage";
export type MeetingModerationPolicy = Readonly<{ allowParticipantMute: boolean; allowParticipantRemove: boolean; raiseHandRequired: boolean }>;

export type CommunityMeetingRoom = Readonly<{
  id: string;
  communityId: string;
  channelId: string | null;
  linkedChatChannelId: string | null;
  title: string;
  description: string;
  mode: Extract<MeetingLayoutMode, "stage"> | "voice" | "meeting";
  status: MeetingRoomStatus;
  joinPolicy: MeetingJoinPolicy;
  capabilities: Pick<MeetingCapabilities, "canPublishAudio" | "canPublishVideo" | "canShareScreen" | "canSendChat" | "canReact" | "canRaiseHand">;
  waitingRoomEnabled: boolean;
  audienceMode: boolean;
  maxParticipants: number;
  moderationPolicy: MeetingModerationPolicy;
  position: number;
  activeSessionCount: number;
  workspace: MeetingWorkspaceDestination;
}>;

export type CommunityMeetingRoomDraft = Readonly<{
  title: string;
  description: string;
  mode: "voice" | "meeting" | "stage";
  categoryId: string | null;
  linkedChatChannelId: string | null;
  joinPolicy: MeetingJoinPolicy;
  capabilities: CommunityMeetingRoom["capabilities"];
  waitingRoomEnabled: boolean;
  audienceMode: boolean;
  maxParticipants: number;
  moderationPolicy: MeetingModerationPolicy;
}>;

export type MeetingRoomArchivePolicy = "deny" | "end" | "transfer";
export type MeetingRoomAdminResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>;
