import type {
  MeetingCapabilities,
  MeetingRole,
  MeetingRoleMapping,
} from "../../types/meeting";
import type {
  CommunityMembershipStatus,
  CommunityPermissionKey,
} from "../../types/communityAccess";

const capabilities = (values: MeetingCapabilities): MeetingCapabilities => Object.freeze(values);

export const MEETING_ROLE_CAPABILITIES: Readonly<Record<MeetingRole, MeetingCapabilities>> = Object.freeze({
  host: capabilities({
    canJoin: true, canPublishAudio: true, canPublishVideo: true, canShareScreen: true,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: true,
    canAdmit: true, canManageParticipants: true, canManageRoles: true, canLockRoom: true,
    canEndRoom: true, canStartCaptions: true, canViewAttendance: true,
  }),
  cohost: capabilities({
    canJoin: true, canPublishAudio: true, canPublishVideo: true, canShareScreen: true,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: true,
    canAdmit: true, canManageParticipants: true, canManageRoles: false, canLockRoom: true,
    canEndRoom: false, canStartCaptions: true, canViewAttendance: true,
  }),
  speaker: capabilities({
    canJoin: true, canPublishAudio: true, canPublishVideo: true, canShareScreen: true,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: false,
    canAdmit: false, canManageParticipants: false, canManageRoles: false, canLockRoom: false,
    canEndRoom: false, canStartCaptions: false, canViewAttendance: false,
  }),
  participant: capabilities({
    canJoin: true, canPublishAudio: true, canPublishVideo: true, canShareScreen: false,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: false,
    canAdmit: false, canManageParticipants: false, canManageRoles: false, canLockRoom: false,
    canEndRoom: false, canStartCaptions: false, canViewAttendance: false,
  }),
  viewer: capabilities({
    canJoin: true, canPublishAudio: false, canPublishVideo: false, canShareScreen: false,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: false,
    canAdmit: false, canManageParticipants: false, canManageRoles: false, canLockRoom: false,
    canEndRoom: false, canStartCaptions: false, canViewAttendance: false,
  }),
  guest: capabilities({
    canJoin: true, canPublishAudio: false, canPublishVideo: false, canShareScreen: false,
    canSendChat: true, canReact: true, canRaiseHand: true, canInvite: false,
    canAdmit: false, canManageParticipants: false, canManageRoles: false, canLockRoom: false,
    canEndRoom: false, canStartCaptions: false, canViewAttendance: false,
  }),
});

const ROLE_MAPPINGS: Readonly<Record<CommunityMembershipStatus, MeetingRoleMapping>> = Object.freeze({
  owner: { meetingRole: "host", communityStatus: "owner", requiredPermissions: ["joinVoice", "manageVoiceRoom"] },
  admin: { meetingRole: "cohost", communityStatus: "admin", requiredPermissions: ["joinVoice", "manageVoiceRoom"] },
  moderator: { meetingRole: "speaker", communityStatus: "moderator", requiredPermissions: ["joinVoice", "speak"] },
  member: { meetingRole: "participant", communityStatus: "member", requiredPermissions: ["joinVoice"] },
  visitor: { meetingRole: "guest", communityStatus: "visitor", requiredPermissions: [] },
});

export function mapCommunityStatusToMeetingRole(
  status: CommunityMembershipStatus,
  options: Readonly<{ forceViewer?: boolean; invitedAsSpeaker?: boolean }> = {},
): MeetingRole {
  if (options.forceViewer) return "viewer";
  if (options.invitedAsSpeaker && status !== "visitor") return "speaker";
  return ROLE_MAPPINGS[status].meetingRole;
}

export function getMeetingRoleMapping(status: CommunityMembershipStatus): MeetingRoleMapping {
  return ROLE_MAPPINGS[status];
}

export function getMeetingCapabilities(
  role: MeetingRole,
  overrides: Readonly<Partial<MeetingCapabilities>> = {},
): MeetingCapabilities {
  return capabilities({ ...MEETING_ROLE_CAPABILITIES[role], ...overrides });
}

export function getMeetingCapabilitiesForCommunityAccess(
  role: MeetingRole,
  status: CommunityMembershipStatus,
  permissions: readonly CommunityPermissionKey[],
): MeetingCapabilities {
  const base = MEETING_ROLE_CAPABILITIES[role];
  if (status === "owner") return base;
  const granted = new Set(permissions);
  const canManage = granted.has("manageVoiceRoom");
  const canSpeak = granted.has("speak") || granted.has("speakInVoice");

  return capabilities({
    ...base,
    canJoin: base.canJoin && (status === "visitor" || granted.has("joinVoice")),
    canPublishAudio: base.canPublishAudio && canSpeak,
    canPublishVideo: base.canPublishVideo && canSpeak,
    canShareScreen: base.canShareScreen && granted.has("shareScreen"),
    canInvite: base.canInvite && granted.has("createInvites"),
    canAdmit: base.canAdmit && canManage,
    canManageParticipants: base.canManageParticipants && (canManage || granted.has("muteMembers") || granted.has("removeFromVoice")),
    canManageRoles: base.canManageRoles && granted.has("manageRoles"),
    canLockRoom: base.canLockRoom && canManage,
    canEndRoom: base.canEndRoom && canManage,
    canStartCaptions: base.canStartCaptions && canManage,
    canViewAttendance: base.canViewAttendance && canManage,
  });
}

export function hasMeetingCapability<K extends keyof MeetingCapabilities>(
  capabilitiesValue: MeetingCapabilities,
  capability: K,
): boolean {
  return capabilitiesValue[capability];
}
