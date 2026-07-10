export type ChannelMessageMetric = Readonly<{
  channelId: string;
  channelName: string;
  channelType: string;
  messageCount: number;
}>;

export type CommunityInsightsSnapshot = Readonly<{
  communityId: string;
  generatedAt: string;
  windowDays: number;
  memberCount: number;
  newMembers: number;
  activeMembers: number;
  messagesTotal: number;
  activeChannels: number;
  messagesByChannel: readonly ChannelMessageMetric[];
  voiceSessions: number;
  voiceParticipantMinutes: number;
  voicePeakConcurrent: number;
  openReports: number;
  reportsTotal: number;
  source: "mock" | "supabase";
}>;

export type CommunityInsightsResult =
  | Readonly<{ ok: true; data: CommunityInsightsSnapshot }>
  | Readonly<{ ok: false; message: string }>;
