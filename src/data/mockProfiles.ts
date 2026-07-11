import { currentUserId as defaultCurrentUserId, mockCommunities } from "./mockCommunities";
import type { Attachment, Channel, Community, Member, Message, Role, UserStatus } from "../types/community";
import type { ProfileActivityItem, ProfileLookupOptions, ProfileMediaItem, ProfileStatus, UserProfile } from "../types/profile";
import { canViewChannel, getCommunityAccess } from "../services/permissions/communityPermissions";
import { selectMockFixture } from "../config/dataSourcePolicy";

const profilePalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"];
const locations = ["Istanbul", "Berlin", "Amsterdam", "Izmir", "Lisbon", "Remote"];
const timezones = ["Europe/Istanbul", "Europe/Berlin", "Europe/Amsterdam", "Europe/Lisbon", "UTC+03"];
const languages = ["Turkish", "English", "English / Turkish", "German", "Spanish"];
const baseTags = ["UI Design", "Frontend", "Community", "Gaming", "Music", "Support", "Moderator", "Voice Chat"];

function hashSeed(seed: string): number {
  return seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function pick<T>(items: T[], seed: string, offset = 0): T {
  return items[(hashSeed(seed) + offset) % items.length];
}

function getChannels(community: Community): Channel[] {
  return community.categories.flatMap((category) => category.channels);
}

function getChannel(community: Community, channelId: string): Channel | undefined {
  return getChannels(community).find((channel) => channel.id === channelId);
}

function getRole(community: Community, member: Member): Role | undefined {
  return community.roles.find((role) => role.id === member.roleId);
}

function getMemberCommunities(communities: Community[], userId: string): Community[] {
  return communities.filter((community) => community.members.some((member) => member.userId === userId));
}

function filterCommunitiesForViewer(communities: Community[], viewerUserId: string): Community[] {
  return communities.flatMap((community) => {
    const access = getCommunityAccess(viewerUserId, community);
    if (!access.isMember && !access.canViewPublicContent) return [];
    const visibleChannelIds = new Set(
      getChannels(community)
        .filter((channel) => canViewChannel(access, channel))
        .map((channel) => channel.id),
    );
    return [{
      ...community,
      categories: community.categories.map((category) => ({
        ...category,
        channels: category.channels.filter((channel) => visibleChannelIds.has(channel.id)),
      })),
      messages: community.messages.filter((message) => visibleChannelIds.has(message.channelId)),
    }];
  });
}

function mapStatus(status: UserStatus): ProfileStatus {
  if (status === "dnd") return "busy";
  return status;
}

function makeSvgMedia(seed: string, title: string, wide = true): string {
  const start = pick(profilePalette, seed, 0);
  const end = pick(profilePalette, seed, 2);
  const mid = pick(profilePalette, seed, 4);
  const width = wide ? 960 : 640;
  const height = wide ? 540 : 640;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${start}"/>
          <stop offset="0.56" stop-color="${mid}"/>
          <stop offset="1" stop-color="${end}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="42" fill="url(#g)"/>
      <circle cx="${width * 0.78}" cy="${height * 0.2}" r="${height * 0.28}" fill="rgba(255,255,255,.18)"/>
      <path d="M0 ${height * 0.78} C ${width * 0.24} ${height * 0.62}, ${width * 0.42} ${height * 0.96}, ${width} ${height * 0.68} L ${width} ${height} L 0 ${height} Z" fill="rgba(255,255,255,.16)"/>
      <text x="44" y="${height - 56}" fill="white" font-family="Segoe UI, Arial" font-size="34" font-weight="700">${title}</text>
    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function attachmentToMedia(attachment: Attachment, message: Message): ProfileMediaItem {
  return {
    id: `${message.id}-${attachment.id}`,
    type: "image",
    url: attachment.publicUrl ?? attachment.url,
    thumbnailUrl: attachment.thumbnailUrl ?? attachment.publicUrl ?? attachment.url,
    title: attachment.alt,
    createdAt: message.createdAt,
  };
}

function getMessageActivities(member: Member, communities: Community[]): ProfileActivityItem[] {
  return communities.flatMap((community) =>
    community.messages
      .filter((message) => message.authorId === member.userId && !message.deletedAt)
      .map((message, index) => {
        const channel = getChannel(community, message.channelId);
        const hasMedia = Boolean(message.attachments?.length);
        const hasReply = Boolean(message.replyToMessageId);
        const hasReaction = Boolean(message.reactions?.length);
        const type = hasMedia ? "media_share" : hasReply ? "reply" : hasReaction ? "reaction" : message.body.includes("@") ? "mention" : "message_post";

        return {
          id: `${message.id}-activity-${index}`,
          type,
          communityId: community.id,
          channelId: channel?.id,
          messageId: message.id,
          title: hasMedia ? `Shared media in #${channel?.name ?? "channel"}` : `Posted in #${channel?.name ?? "channel"}`,
          preview: message.body,
          createdAt: message.createdAt,
        } satisfies ProfileActivityItem;
      }),
  );
}

function getMedia(member: Member, communities: Community[]): ProfileMediaItem[] {
  const messageMedia = communities.flatMap((community) =>
    community.messages
      .filter((message) => message.authorId === member.userId && !message.deletedAt)
      .flatMap((message) => (message.attachments ?? []).map((attachment) => attachmentToMedia(attachment, message))),
  );

  const fallbackMedia: ProfileMediaItem[] = [
    {
      id: `${member.userId}-studio-shot`,
      type: "image",
      url: makeSvgMedia(`${member.userId}-studio`, "Workspace signal"),
      title: "Workspace signal",
      createdAt: "2026-07-01T09:00:00.000Z",
    },
    {
      id: `${member.userId}-community-shot`,
      type: "image",
      url: makeSvgMedia(`${member.userId}-community`, "Community moment", false),
      title: "Community moment",
      createdAt: "2026-07-02T14:00:00.000Z",
    },
    {
      id: `${member.userId}-voice-placeholder`,
      type: "video_placeholder",
      url: makeSvgMedia(`${member.userId}-voice`, "Voice clip"),
      title: "Voice clip placeholder",
      createdAt: "2026-07-03T18:30:00.000Z",
    },
  ];

  return [...messageMedia, ...fallbackMedia].slice(0, 8);
}

function getFallbackActivity(member: Member, community: Community | undefined): ProfileActivityItem[] {
  const firstTextChannel = community ? getChannels(community).find((channel) => channel.type === "text") : undefined;

  return [
    {
      id: `${member.userId}-fallback-activity-1`,
      type: "message_post",
      communityId: community?.id,
      channelId: firstTextChannel?.id,
      title: "Joined the desktop conversation",
      preview: `${member.displayName} is getting their Picom workspace ready.` ,
      createdAt: "2026-07-01T11:20:00.000Z",
    },
    {
      id: `${member.userId}-fallback-activity-2`,
      type: "reaction",
      communityId: community?.id,
      channelId: firstTextChannel?.id,
      title: "Reacted to a community update",
      preview: "Added a quick reaction to keep the discussion moving.",
      createdAt: "2026-07-02T16:45:00.000Z",
    },
  ];
}

function getTags(member: Member, roles: string[]): string[] {
  const roleTags = roles.filter((role) => role !== "Member").slice(0, 2);
  const selected = [pick(baseTags, member.userId, 1), pick(baseTags, member.userId, 3), pick(baseTags, member.userId, 5)];
  return Array.from(new Set([...roleTags, ...selected, member.status === "offline" ? "Async" : "Live now"])).slice(0, 7);
}

function makeProfile(member: Member, communities: Community[], options: ProfileLookupOptions): UserProfile {
  const visibleCommunities = filterCommunitiesForViewer(communities, options.currentUserId);
  const profileCommunities = getMemberCommunities(visibleCommunities, member.userId);
  const primaryCommunity = profileCommunities[0] ?? communities[0];
  const roles = profileCommunities.map((community) => getRole(community, member)?.name ?? "Member");
  const uniqueRoles = Array.from(new Set(roles.length ? roles : ["Member"]));
  const activities = getMessageActivities(member, visibleCommunities).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const media = getMedia(member, visibleCommunities);
  const visibleActivities = activities.length ? activities : getFallbackActivity(member, primaryCommunity);
  const reactionCount = visibleCommunities.flatMap((community) => community.messages).filter((message) => message.authorId === member.userId).reduce((total, message) => total + (message.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0), 0);
  const seedNumber = hashSeed(member.userId);

  return {
    id: member.userId,
    displayName: member.displayName,
    username: member.username,
    avatarUrl: member.avatarUrl,
    coverUrl: makeSvgMedia(`${member.userId}-cover`, `${member.displayName} profile`),
    status: mapStatus(member.status),
    statusText: member.statusText,
    location: pick(locations, member.userId),
    timezone: pick(timezones, member.userId, 2),
    joinedAt: new Date(Date.UTC(2025, seedNumber % 12, (seedNumber % 24) + 1, 10, 0, 0)).toISOString(),
    bio: member.bio ?? `${member.displayName} keeps conversations focused, friendly, and useful across Picom communities.`,
    roles: uniqueRoles,
    tags: getTags(member, uniqueRoles),
    mainCommunityId: primaryCommunity?.id,
    topRole: uniqueRoles[0] ?? "Member",
    preferredLanguage: pick(languages, member.userId, 4),
    activityScore: 52 + (seedNumber % 46),
    isCurrentUser: member.userId === options.currentUserId,
    isFollowing: options.followedUserIds.includes(member.userId),
    onboardingCompleted: true,
    privacy: { visibility: "everyone", canViewProfile: true, showOnlineStatus: true, showLocation: true, showTimezone: true, showActivity: true, showMedia: true, showCommunities: true, showFriends: true, showFollows: true, showAudio: true },
    stats: {
      communities: profileCommunities.length,
      posts: Math.max(visibleActivities.length, activities.length),
      mentions: visibleActivities.filter((activity) => activity.type === "mention").length + (seedNumber % 9),
      reactions: reactionCount + (seedNumber % 40),
      followers: 80 + (seedNumber % 420),
      following: 12 + (seedNumber % 90),
      roles: uniqueRoles.length,
    },
    media,
    activities: visibleActivities,
  };
}

export function createMockProfiles(communities: Community[] = mockCommunities, options: Partial<ProfileLookupOptions> = {}): UserProfile[] {
  const lookupOptions: ProfileLookupOptions = {
    currentUserId: options.currentUserId ?? defaultCurrentUserId,
    followedUserIds: options.followedUserIds ?? [],
  };
  const uniqueMembers = new Map<string, Member>();

  for (const community of communities) {
    for (const member of community.members) {
      if (!uniqueMembers.has(member.userId)) uniqueMembers.set(member.userId, member);
    }
  }

  return Array.from(uniqueMembers.values()).map((member) => makeProfile(member, communities, lookupOptions));
}

export function getMockProfileForMember(member: Member, communities: Community[], options: ProfileLookupOptions): UserProfile {
  return makeProfile(member, communities, options);
}

export const mockProfiles = selectMockFixture<UserProfile[]>(createMockProfiles(), []);
