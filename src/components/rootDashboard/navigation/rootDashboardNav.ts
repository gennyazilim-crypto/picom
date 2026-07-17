import type { IconName } from "../../AppIcon";

export type RootDashboardRouteKey =
  | "overview"
  | "platform"
  | "users"
  | "communities"
  | "secretCommunities"
  | "content"
  | "messaging"
  | "voice"
  | "support"
  | "supportTeam"
  | "trustSafety"
  | "moderationTeam"
  | "security"
  | "securityTeam"
  | "advertising"
  | "advertisingTeam"
  | "adCreativeReview"
  | "revenue"
  | "financeApproval"
  | "radio"
  | "podcast"
  | "notifications"
  | "emailOperations"
  | "analytics"
  | "systemHealth"
  | "incidents"
  | "rolesPermissions"
  | "auditLogs"
  | "featureFlags"
  | "reportsExports"
  | "settings"
  | "commandCenter";

export type RootDashboardNavItem = Readonly<{
  key: RootDashboardRouteKey;
  label: string;
  icon: IconName;
}>;

export type RootDashboardNavGroup = Readonly<{
  id: string;
  label: string;
  items: readonly RootDashboardNavItem[];
}>;

export const ROOT_DASHBOARD_NAV_GROUPS: readonly RootDashboardNavGroup[] = [
  {
    id: "home",
    label: "Home",
    items: [
      { key: "overview", label: "Overview", icon: "home" },
      { key: "platform", label: "Platform", icon: "settings" },
      { key: "commandCenter", label: "Command Center", icon: "search" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { key: "users", label: "Users", icon: "users" },
      { key: "communities", label: "Communities", icon: "hash" },
      { key: "secretCommunities", label: "Secret communities", icon: "lock" },
      { key: "content", label: "Content", icon: "image" },
      { key: "messaging", label: "DM Safety", icon: "inbox" },
      { key: "voice", label: "Voice", icon: "voice" },
    ],
  },
  {
    id: "care",
    label: "Care & Safety",
    items: [
      { key: "support", label: "Support", icon: "bell" },
      { key: "supportTeam", label: "Support Team", icon: "users" },
      { key: "trustSafety", label: "Trust & Safety", icon: "lock" },
      { key: "moderationTeam", label: "Moderation Team", icon: "eye" },
      { key: "security", label: "Security", icon: "lock" },
      { key: "securityTeam", label: "Security Team", icon: "users" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { key: "advertising", label: "Advertising", icon: "pin" },
      { key: "advertisingTeam", label: "Advertising Team", icon: "users" },
      { key: "adCreativeReview", label: "Ad Creative Review", icon: "image" },
      { key: "revenue", label: "Revenue", icon: "inbox" },
      { key: "financeApproval", label: "Finance Approval", icon: "edit" },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [
      { key: "radio", label: "Radio", icon: "volume" },
      { key: "podcast", label: "Podcast", icon: "play" },
      { key: "notifications", label: "Notifications", icon: "bell" },
      { key: "emailOperations", label: "Email Operations", icon: "inbox" },
      { key: "analytics", label: "Analytics", icon: "search" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { key: "systemHealth", label: "System Health", icon: "settings" },
      { key: "incidents", label: "Incidents", icon: "bell" },
      { key: "rolesPermissions", label: "Roles & Permissions", icon: "lock" },
      { key: "auditLogs", label: "Audit Logs", icon: "eye" },
      { key: "featureFlags", label: "Feature Flags", icon: "more" },
      { key: "reportsExports", label: "Reports & Exports", icon: "paperclip" },
      { key: "settings", label: "Dashboard Settings", icon: "settings" },
    ],
  },
];

export function routeLabel(key: RootDashboardRouteKey): string {
  return findRootDashboardNavItem(key)?.label ?? key;
}

export function findRootDashboardNavItem(key: RootDashboardRouteKey): RootDashboardNavItem | undefined {
  for (const group of ROOT_DASHBOARD_NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return item;
  }
  return undefined;
}

export function flattenNavItems(): RootDashboardNavItem[] {
  return ROOT_DASHBOARD_NAV_GROUPS.flatMap((group) => [...group.items]);
}
