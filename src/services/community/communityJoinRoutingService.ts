import type { Community, CommunityKind } from "../../types/community";

export type CommunityJoinLanding = Readonly<{
  view: "community" | "radioCommunity" | "podcastCommunity";
  channelId?: string;
  landingLabel: string;
}>;

export type CommunityKindInviteSummary = Readonly<{
  kind: CommunityKind;
  label: string;
  capabilitySummary: readonly string[];
  visitorCopy: string;
  landingLabel: string;
}>;

const summaries: Readonly<Record<CommunityKind, CommunityKindInviteSummary>> = {
  text: {
    kind: "text",
    label: "Text community",
    capabilitySummary: ["Channels and messages", "Replies, reactions, and attachments"],
    visitorCopy: "You can read allowed public channels. Join to send messages, react, reply, and upload.",
    landingLabel: "Welcome or General",
  },
  radio: {
    kind: "radio",
    label: "Radio community",
    capabilitySummary: ["Live station and listening", "Schedule, programs, and hosts"],
    visitorCopy: "You can review public station information. Join to listen as a member and use listener interactions.",
    landingLabel: "Live and Schedule",
  },
  podcast: {
    kind: "podcast",
    label: "Podcast community",
    capabilitySummary: ["Episodes and series", "Listener reactions and comments"],
    visitorCopy: "You can browse published public episodes. Join to react, comment, and follow library updates.",
    landingLabel: "Episodes",
  },
};

export function getCommunityKindInviteSummary(kind: CommunityKind): CommunityKindInviteSummary {
  return summaries[kind];
}

export function resolveCommunityJoinLanding(community: Community): CommunityJoinLanding {
  if (community.kind === "radio") return { view: "radioCommunity", landingLabel: summaries.radio.landingLabel };
  if (community.kind === "podcast") return { view: "podcastCommunity", landingLabel: summaries.podcast.landingLabel };
  const channels = community.categories.flatMap((category) => category.channels).filter((channel) => channel.type === "text" || channel.type === "announcement");
  const channel = channels.find((candidate) => candidate.name.trim().toLowerCase() === "welcome")
    ?? channels.find((candidate) => candidate.name.trim().toLowerCase() === "general")
    ?? channels[0];
  return { view: "community", channelId: channel?.id, landingLabel: channel ? `#${channel.name}` : summaries.text.landingLabel };
}
