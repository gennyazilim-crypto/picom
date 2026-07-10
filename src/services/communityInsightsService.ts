import type { Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { ChannelMessageMetric, CommunityInsightsResult, CommunityInsightsSnapshot } from "../types/communityInsights";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const DEFAULT_WINDOW_DAYS = 30;

function canView(access: CommunityAccess): boolean {
  return access.isOwner || access.isAdmin || access.permissions.includes("viewInsights");
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseChannels(value: unknown): ChannelMessageMetric[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.channel_id !== "string" || typeof row.channel_name !== "string") return [];
    return [{ channelId: row.channel_id, channelName: row.channel_name, channelType: typeof row.channel_type === "string" ? row.channel_type : "text", messageCount: asNumber(row.message_count) }];
  });
}

function buildMockSnapshot(community: Community, windowDays: number): CommunityInsightsSnapshot {
  const channels = community.categories.flatMap((category) => category.channels);
  const messagesByChannel = channels.map((channel) => ({ channelId: channel.id, channelName: channel.name, channelType: channel.type, messageCount: community.messages.filter((message) => message.channelId === channel.id && !message.deletedAt).length })).filter((metric) => metric.messageCount > 0).sort((left, right) => right.messageCount - left.messageCount);
  const visibleMessages = community.messages.filter((message) => !message.deletedAt);
  return { communityId: community.id, generatedAt: new Date().toISOString(), windowDays, memberCount: community.members.length, newMembers: 0, activeMembers: new Set(visibleMessages.map((message) => message.authorId)).size, messagesTotal: visibleMessages.length, activeChannels: messagesByChannel.length, messagesByChannel, voiceSessions: 0, voiceParticipantMinutes: 0, voicePeakConcurrent: 0, openReports: 0, reportsTotal: 0, source: "mock" };
}

function parseRemoteSnapshot(communityId: string, value: unknown): CommunityInsightsSnapshot | null {
  const row = asRecord(value);
  if (!row) return null;
  return { communityId, generatedAt: typeof row.generated_at === "string" ? row.generated_at : new Date().toISOString(), windowDays: asNumber(row.window_days) || DEFAULT_WINDOW_DAYS, memberCount: asNumber(row.member_count), newMembers: asNumber(row.new_members), activeMembers: asNumber(row.active_members), messagesTotal: asNumber(row.messages_total), activeChannels: asNumber(row.active_channels), messagesByChannel: parseChannels(row.messages_by_channel), voiceSessions: asNumber(row.voice_sessions), voiceParticipantMinutes: asNumber(row.voice_participant_minutes), voicePeakConcurrent: asNumber(row.voice_peak_concurrent), openReports: asNumber(row.open_reports), reportsTotal: asNumber(row.reports_total), source: "supabase" };
}

export const communityInsightsService = {
  async getSnapshot(community: Community, access: CommunityAccess, windowDays = DEFAULT_WINDOW_DAYS): Promise<CommunityInsightsResult> {
    if (!canView(access)) return { ok: false, message: "Community insights require owner or permitted admin access." };
    const safeWindow = Math.min(Math.max(Math.round(windowDays), 1), 90);
    if (dataSourceService.getStatus().isMock) return { ok: true, data: buildMockSnapshot(community, safeWindow) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Community insights are unavailable while the API is not configured." };
    const { data, error } = await client.rpc("get_community_insights_v2", { target_community_id: community.id, window_days: safeWindow });
    if (error) return { ok: false, message: error.code === "42501" ? "You do not have permission to view these insights." : "Community insights could not be loaded." };
    const snapshot = parseRemoteSnapshot(community.id, data);
    return snapshot ? { ok: true, data: snapshot } : { ok: false, message: "Community insights returned an invalid response." };
  },
};
