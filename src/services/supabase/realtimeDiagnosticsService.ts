import { getSupabaseClient } from "./supabaseClient";

export type RealtimeChannelKind = "community" | "typing" | "presence" | "direct" | "friends" | "feed" | "radio" | "podcast" | "other";
export type RealtimeDiagnosticsSnapshot = Readonly<{
  activeChannelCount: number;
  duplicateChannelCount: number;
  withinBudget: boolean;
  byKind: Readonly<Record<RealtimeChannelKind, number>>;
}>;

const MAX_EXPECTED_CHANNELS = 48;
const emptyCounts = (): Record<RealtimeChannelKind, number> => ({ community: 0, typing: 0, presence: 0, direct: 0, friends: 0, feed: 0, radio: 0, podcast: 0, other: 0 });

function classify(topic: string): RealtimeChannelKind {
  const normalized = topic.replace(/^realtime:/, "");
  if (normalized.startsWith("room:community:")) return "community";
  if (normalized.startsWith("typing:community:")) return "typing";
  if (normalized.startsWith("presence:community:")) return "presence";
  if (normalized.startsWith("dm:")) return "direct";
  if (normalized.startsWith("friend-")) return "friends";
  if (normalized.startsWith("feed:")) return "feed";
  if (normalized.startsWith("radio:")) return "radio";
  if (normalized.startsWith("podcast:")) return "podcast";
  return "other";
}

export const realtimeDiagnosticsService = {
  snapshot(): RealtimeDiagnosticsSnapshot {
    const topics = (getSupabaseClient()?.getChannels() ?? []).map((channel) => channel.topic);
    const byKind = emptyCounts();
    for (const topic of topics) byKind[classify(topic)] += 1;
    return {
      activeChannelCount: topics.length,
      duplicateChannelCount: topics.length - new Set(topics).size,
      withinBudget: topics.length <= MAX_EXPECTED_CHANNELS,
      byKind,
    };
  },
};
