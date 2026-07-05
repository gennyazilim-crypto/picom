export type MockVoiceState = Readonly<{
  isInVoiceRoom: boolean;
  roomName: string;
  communityName: string;
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing?: boolean;
}>;
