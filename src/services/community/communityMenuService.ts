import type { CommunityMenuItemDescriptor } from "../../types/communityAccess";
import type { CommunityAccess } from "../../types/communityAccess";

export function getCommunityMenuItems(access: CommunityAccess): CommunityMenuItemDescriptor[] {
  if (access.status === "owner") {
    return [
      { id: "community-settings", label: "Community settings" },
      { id: "admin-panel", label: "Admin panel" },
      { id: "manage-channels", label: "Manage channels", permission: "manageChannels" },
      { id: "manage-roles", label: "Manage roles", permission: "manageRoles" },
      { id: "invite-people", label: "Invite people", permission: "createInvites" },
      { id: "audit-log", label: "Audit log placeholder", permission: "viewAuditLog" },
      { id: "transfer-ownership", label: "Transfer ownership" },
      { id: "delete-community", label: "Delete community", tone: "danger" },
      { id: "leave-community", label: "Leave community", disabled: true, description: "Transfer ownership before leaving." },
    ];
  }

  if (access.status === "admin") {
    return [
      { id: "community-settings", label: "Community settings" },
      { id: "admin-panel", label: "Admin panel" },
      { id: "manage-channels", label: "Manage channels", permission: "manageChannels" },
      { id: "manage-members", label: "Manage members", permission: "manageMembers" },
      { id: "manage-roles", label: "Manage roles", permission: "manageRoles" },
      { id: "invite-people", label: "Invite people", permission: "createInvites" },
      { id: "audit-log", label: "Audit log placeholder", permission: "viewAuditLog" },
      { id: "leave-community", label: "Leave community" },
    ];
  }

  if (access.status === "moderator") {
    return [
      { id: "moderator-panel", label: "Moderator panel" },
      { id: "report-community", label: "View reports placeholder", permission: "moderateMessages" },
      { id: "manage-members", label: "Timeout/kick placeholder", permission: "manageMembers" },
      { id: "invite-people", label: "Invite people", permission: "createInvites" },
      { id: "notification-settings", label: "Notification settings" },
      { id: "leave-community", label: "Leave community" },
    ];
  }

  if (access.status === "member") {
    return [
      { id: "community-info", label: "Community info" },
      { id: "notification-settings", label: "Notification settings" },
      { id: "invite-people", label: "Invite people", permission: "createInvites" },
      { id: "copy-community-link", label: "Copy community link placeholder" },
      { id: "leave-community", label: "Leave community" },
      { id: "report-community", label: "Report community placeholder" },
    ];
  }

  return [
    { id: "community-info", label: "Community info" },
    { id: "join-community", label: "Join Community" },
    { id: "copy-community-link", label: "Copy community link placeholder" },
    { id: "report-community", label: "Report community placeholder" },
  ];
}
