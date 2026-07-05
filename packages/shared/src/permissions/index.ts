export type PermissionKey =
  | "manageCommunity"
  | "manageChannels"
  | "manageRoles"
  | "deleteAnyMessage"
  | "editOwnMessage"
  | "deleteOwnMessage"
  | "sendMessages"
  | "viewPrivateChannels"
  | "kickMembers"
  | "banMembers"
  | "manageNotifications"
  | "manageWebhooks"
  | "viewInsights"
  | "sendAnnouncements";

export type PermissionMapDTO = Partial<Record<PermissionKey, boolean>>;
