import type { CommunityKind } from "../../types/community";
import type { CommunityPermissionKey } from "../../types/communityAccess";

export type CommunityPermissionGroupName = "General" | "Membership" | "Text" | "Voice" | "Meetings" | "Radio" | "Podcast" | "Moderation" | "Administration";
export type CommunityPermissionDefinition = Readonly<{ key: CommunityPermissionKey; label: string; description: string; kinds: readonly CommunityKind[] }>;
export type CommunityPermissionGroup = Readonly<{ name: CommunityPermissionGroupName; permissions: readonly CommunityPermissionDefinition[] }>;

const all = ["text", "radio", "podcast"] as const;
const text = ["text"] as const;
const radio = ["radio"] as const;
const podcast = ["podcast"] as const;

export const COMMUNITY_PERMISSION_GROUPS: readonly CommunityPermissionGroup[] = [
  { name: "General", permissions: [
    { key: "viewChannel", label: "View channels", description: "View accessible Text channels and content.", kinds: text },
    { key: "viewPrivateChannels", label: "View private channels", description: "View private Text channels granted to this role.", kinds: text },
    { key: "viewInsights", label: "View insights", description: "View privacy-safe community insights.", kinds: all },
  ] },
  { name: "Membership", permissions: [
    { key: "createInvites", label: "Create invites", description: "Create limited and expiring community invites.", kinds: all },
    { key: "manageMembers", label: "Manage members", description: "Manage ordinary members below this role.", kinds: all },
  ] },
  { name: "Text", permissions: [
    { key: "sendMessages", label: "Send messages", description: "Send messages and replies in writable channels.", kinds: text },
    { key: "sendAnnouncements", label: "Publish announcements", description: "Publish in announcement channels.", kinds: text },
    { key: "uploadAttachments", label: "Upload attachments", description: "Upload validated message attachments.", kinds: text },
    { key: "addReactions", label: "Add reactions", description: "Add and remove own message reactions.", kinds: text },
  ] },
  { name: "Voice", permissions: [
    { key: "joinVoice", label: "Join voice", description: "Join a configured and accessible voice channel.", kinds: all },
    { key: "speak", label: "Speak", description: "Publish microphone audio in normal voice rooms.", kinds: all },
    { key: "speakInVoice", label: "Speak in voice (legacy)", description: "Compatibility alias for existing grants.", kinds: all },
    { key: "shareScreen", label: "Share screen", description: "Publish an approved screen-share track.", kinds: all },
    { key: "muteMembers", label: "Mute members", description: "Server-mute lower-ranked voice participants.", kinds: all },
    { key: "removeFromVoice", label: "Remove from voice", description: "Remove lower-ranked participants from a voice room.", kinds: all },
    { key: "manageVoiceRoom", label: "Manage voice room", description: "Manage normal voice rooms and their participants.", kinds: all },
  ] },
  { name: "Meetings", permissions: [
    { key: "createMeeting", label: "Create meetings", description: "Create approved meeting rooms.", kinds: all },
    { key: "manageMeeting", label: "Manage meetings", description: "Manage meeting lifecycle and policy.", kinds: all },
    { key: "joinMeeting", label: "Join meetings", description: "Join accessible open meetings.", kinds: all },
    { key: "publishAudio", label: "Publish audio", description: "Publish microphone audio in meetings.", kinds: all },
    { key: "publishVideo", label: "Publish video", description: "Publish camera video in meetings.", kinds: all },
    { key: "admitGuests", label: "Admit guests", description: "Admit or deny waiting-room guests.", kinds: all },
    { key: "manageParticipants", label: "Manage participants", description: "Moderate lower-ranked meeting participants.", kinds: all },
    { key: "manageStage", label: "Manage stage", description: "Promote and demote lower-ranked stage participants.", kinds: all },
    { key: "viewMeetingHistory", label: "View meeting history", description: "View privacy-bounded attendance and history.", kinds: all },
    { key: "enableCaptions", label: "Enable captions", description: "Enable configured consent-gated captions.", kinds: all },
  ] },
  { name: "Radio", permissions: [
    { key: "viewRadioContent", label: "View Radio", description: "View accessible Radio content.", kinds: radio },
    { key: "listenRadio", label: "Listen to Radio", description: "Listen to live Radio sessions.", kinds: radio },
    { key: "hostRadio", label: "Host Radio", description: "Host an assigned Radio session.", kinds: radio },
    { key: "manageRadioSchedule", label: "Manage schedule", description: "Create and update Radio schedules.", kinds: radio },
    { key: "manageRadioPrograms", label: "Manage programs", description: "Create and edit Radio programs.", kinds: radio },
    { key: "manageRadioHosts", label: "Manage hosts", description: "Assign producers and hosts below this role.", kinds: radio },
    { key: "publishRadioAnnouncements", label: "Publish announcements", description: "Publish station announcements.", kinds: radio },
    { key: "manageRadioCommunity", label: "Manage Radio settings", description: "Manage station-level settings.", kinds: radio },
  ] },
  { name: "Podcast", permissions: [
    { key: "viewPodcastContent", label: "View Podcasts", description: "View accessible Podcast content.", kinds: podcast },
    { key: "listenPodcasts", label: "Listen to Podcasts", description: "Play published episodes.", kinds: podcast },
    { key: "createPodcastDrafts", label: "Create drafts", description: "Create episode drafts.", kinds: podcast },
    { key: "publishPodcasts", label: "Publish episodes", description: "Publish Podcast episodes.", kinds: podcast },
    { key: "editPodcastMetadata", label: "Edit metadata", description: "Edit episode metadata.", kinds: podcast },
    { key: "archivePodcastEpisodes", label: "Archive episodes", description: "Archive published or draft episodes.", kinds: podcast },
    { key: "moderatePodcastEpisodes", label: "Moderate episodes", description: "Moderate episode visibility.", kinds: podcast },
    { key: "managePodcastSeries", label: "Manage series", description: "Create and edit Podcast series.", kinds: podcast },
    { key: "commentOnPodcasts", label: "Comment", description: "Comment on accessible episodes.", kinds: podcast },
    { key: "reactToPodcasts", label: "React", description: "React to accessible episodes.", kinds: podcast },
    { key: "managePodcastCommunity", label: "Manage Podcast settings", description: "Manage library-level settings.", kinds: podcast },
  ] },
  { name: "Moderation", permissions: [
    { key: "moderateMembers", label: "Moderate members", description: "Apply approved actions to lower members.", kinds: all },
    { key: "moderateMessages", label: "Moderate messages", description: "Moderate content in visible channels.", kinds: all },
    { key: "deleteAnyMessage", label: "Delete any message", description: "Delete another author message with policy checks.", kinds: all },
    { key: "moderateRadioComments", label: "Moderate Radio comments", description: "Review and remove Radio comments.", kinds: radio },
    { key: "moderatePodcastComments", label: "Moderate Podcast comments", description: "Review and remove Podcast comments.", kinds: podcast },
  ] },
  { name: "Administration", permissions: [
    { key: "manageCommunity", label: "Manage community", description: "Manage ordinary community settings.", kinds: all },
    { key: "manageChannels", label: "Manage channels", description: "Create, edit, order, and archive channels.", kinds: all },
    { key: "manageCategories", label: "Manage categories", description: "Create, edit, order, and archive categories.", kinds: all },
    { key: "managePermissionOverrides", label: "Manage overrides", description: "Manage approved resource-scoped overrides.", kinds: all },
    { key: "manageRoles", label: "Manage roles", description: "Manage roles strictly below this role.", kinds: all },
    { key: "viewAuditLog", label: "View audit log", description: "View the immutable community audit trail.", kinds: all },
    { key: "manageTextCommunity", label: "Manage Text workspace", description: "Manage Text community configuration.", kinds: text },
  ] },
];

export const ALL_COMMUNITY_PERMISSION_KEYS = [...new Set(COMMUNITY_PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key)))];

export function getPermissionGroupsForKind(kind: CommunityKind): readonly CommunityPermissionGroup[] {
  return COMMUNITY_PERMISSION_GROUPS.map((group) => ({ ...group, permissions: group.permissions.filter((permission) => permission.kinds.includes(kind)) })).filter((group) => group.permissions.length > 0);
}
