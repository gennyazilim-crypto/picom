export type VoiceChannelParticipant = Readonly<{
  identity: string;
  name: string;
  isSpeaking?: boolean;
  isMicrophoneEnabled?: boolean;
}>;

export type ActiveVoiceRoomSummary = Readonly<{
  communityId: string;
  communityName: string;
  channelId: string;
  channelName: string;
  participantCount: number;
  participantNames: string[];
  isPrivate: boolean;
  canJoin: boolean;
  joinBlockedReason?: string;
  source: "mock" | "realtime";
}>;

export type VoiceRoomOccupancy = Readonly<{
  participantCount: number;
  participantNames?: string[];
  participants?: VoiceChannelParticipant[];
}>;
