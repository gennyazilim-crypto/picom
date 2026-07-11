import type { Community } from "../../types/community";

export type CommunityShellView = "community" | "radioCommunity" | "podcastCommunity";
export type RadioCommunitySection = "live" | "schedule" | "programs" | "hosts" | "announcements" | "listenerChat";
export type PodcastCommunitySection = "episodes" | "series" | "drafts" | "hosts" | "about" | "moderation" | "listenerDiscussion";

type RouteMemory = Readonly<{
  textChannelId?: string;
  radioSection?: RadioCommunitySection;
  radioSessionId?: string;
  podcastSection?: PodcastCommunitySection;
  podcastEpisodeId?: string;
}>;

const STORAGE_KEY = "picom.community-route-memory.v1";
const radioSections = new Set<RadioCommunitySection>(["live", "schedule", "programs", "hosts", "announcements", "listenerChat"]);
const podcastSections = new Set<PodcastCommunitySection>(["episodes", "series", "drafts", "hosts", "about", "moderation", "listenerDiscussion"]);

function loadMemory(): Record<string, RouteMemory> {
  try {
    if (typeof sessionStorage === "undefined") return {};
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, RouteMemory> : {};
  } catch { return {}; }
}

let memory = loadMemory();

function persist() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch { /* Route memory is best-effort and never blocks navigation. */ }
}

function update(communityId: string, patch: Partial<RouteMemory>) {
  if (!communityId) return;
  memory = { ...memory, [communityId]: { ...memory[communityId], ...patch } };
  persist();
}

function channelsOf(community: Community) {
  return community.categories.flatMap((category) => category.channels);
}

export const communityNavigationService = {
  getShellView(kind: Community["kind"]): CommunityShellView {
    return kind === "text" ? "community" : kind === "radio" ? "radioCommunity" : "podcastCommunity";
  },
  getShellChannelId(community: Community): string {
    return `shell:${community.kind}:${community.id}`;
  },
  resolveTextChannelId(community: Community, preferredChannelId?: string | null): string | null {
    if (community.kind !== "text") return null;
    const channels = channelsOf(community);
    const preferred = preferredChannelId ? channels.find((channel) => channel.id === preferredChannelId) : undefined;
    const remembered = memory[community.id]?.textChannelId ? channels.find((channel) => channel.id === memory[community.id]?.textChannelId) : undefined;
    return preferred?.id ?? remembered?.id ?? channels.find((channel) => channel.type === "text")?.id ?? channels[0]?.id ?? null;
  },
  rememberTextChannel(community: Community, channelId: string): boolean {
    if (community.kind !== "text" || !channelsOf(community).some((channel) => channel.id === channelId)) return false;
    update(community.id, { textChannelId: channelId });
    return true;
  },
  getRadioSection(communityId: string): RadioCommunitySection {
    const section = memory[communityId]?.radioSection;
    return section && radioSections.has(section) ? section : "live";
  },
  rememberRadioSection(communityId: string, section: RadioCommunitySection) {
    update(communityId, { radioSection: radioSections.has(section) ? section : "live" });
  },
  getRadioSessionId(communityId: string): string | null { return memory[communityId]?.radioSessionId ?? null; },
  rememberRadioSession(communityId: string, sessionId: string | null) { update(communityId, { radioSessionId: sessionId || undefined }); },
  getPodcastSection(communityId: string): PodcastCommunitySection {
    const section = memory[communityId]?.podcastSection;
    return section && podcastSections.has(section) ? section : "episodes";
  },
  rememberPodcastSection(communityId: string, section: PodcastCommunitySection) {
    update(communityId, { podcastSection: podcastSections.has(section) ? section : "episodes" });
  },
  getPodcastEpisodeId(communityId: string): string | null { return memory[communityId]?.podcastEpisodeId ?? null; },
  rememberPodcastEpisode(communityId: string, episodeId: string | null) { update(communityId, { podcastEpisodeId: episodeId || undefined }); },
  forgetCommunity(communityId: string) {
    const { [communityId]: _removed, ...rest } = memory;
    memory = rest;
    persist();
  },
};
