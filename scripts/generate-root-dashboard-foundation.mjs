import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("docs/root-dashboard/ASTRAL_ADMIN_REFERENCE.md", `# Astral Admin visual/IA reference

Source: https://lightswind.com/templates/astral-admin

Adopted for Picom Root Dashboard (layout only — Picom tokens stay teal/charcoal):

1. Collapsible left sidebar with hierarchical nav groups + section labels
2. Sticky top header: breadcrumb, command search (Ctrl/Cmd+K), env badge, realtime, account
3. Dense KPI strip (trend/sparkline capable) above charts
4. Split content: charts + tables, filter bar sticky under header
5. Support/ops pages as multi-pane where needed
6. Subtle frosted panels via color-mix — not heavy glass / purple neon

Do not copy Lightswind branding, Geist-only typography, or blue Pro badges.
`);

w("docs/root-dashboard/ROOT_DASHBOARD_UI_DISCOVERY.md", `# Root Dashboard UI Discovery (Task 01)

## Goal

Owner-only Picom management dashboard UI that reuses Picom charcoal/cool-gray + teal language, is permission-aware, and never presents fabricated metrics.

Visual / IA reference: [Astral Engine Enterprise Dashboard](https://lightswind.com/templates/astral-admin) (see \`ASTRAL_ADMIN_REFERENCE.md\`).

Root bootstrap account: \`f.tayboga@gmail.com\` (server-side \`app_admin\` / RLS remains authority).

## Existing surfaces audited

| Area | Location | Notes |
|------|----------|-------|
| Global sidebar | \`GlobalAppSidebar.tsx\` | No Panel entry yet |
| Admin Operations | \`AdminOperationsPanel.tsx\` | Settings nest; fail-closed |
| Tokens | \`styles.css\` | \`--surface\`, \`--accent\`, \`--warning\` |
| Charts / table kit | — | Built under \`rootDashboard/\` |

## Information architecture

Panel → Shell → Overview + domain modules (Users, Communities, Support, Security, Ads, Revenue, Radio, Podcast, Health, Incidents, Roles, Audit, Flags, Reports, Settings, Command Center).

## Implementation order

01 Discovery → 02 Panel entry → 03 Shell → 04 Nav → 05 Overview → 06–09 primitives → 10–35 modules → 36–40 polish/audit.
`);

w("src/services/rootDashboard/rootDashboardAccessService.ts", `import { adminOperationsService, type AdminOperationsAccess } from "../adminOperationsService";

export type RootDashboardAccessStatus = "loading" | "allowed" | "denied";

export type RootDashboardAccessState = Readonly<{
  status: RootDashboardAccessStatus;
  source: AdminOperationsAccess["source"];
  allowed: boolean;
  checkedAt: string | null;
}>;

export const rootDashboardAccessService = {
  async resolveAccess(): Promise<RootDashboardAccessState> {
    const access = await adminOperationsService.getAccess();
    return {
      status: access.allowed ? "allowed" : "denied",
      source: access.source,
      allowed: access.allowed,
      checkedAt: new Date().toISOString(),
    };
  },
};
`);

w("src/hooks/useRootDashboardAccess.ts", `import { useCallback, useEffect, useState } from "react";
import { rootDashboardAccessService, type RootDashboardAccessState } from "../services/rootDashboard/rootDashboardAccessService";

const initial: RootDashboardAccessState = {
  status: "loading",
  source: "none",
  allowed: false,
  checkedAt: null,
};

export function useRootDashboardAccess(enabled = true) {
  const [state, setState] = useState<RootDashboardAccessState>(initial);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(initial);
      return;
    }
    setState((current) => ({ ...current, status: "loading" }));
    setState(await rootDashboardAccessService.resolveAccess());
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState(initial);
      return;
    }
    setState(initial);
    void rootDashboardAccessService.resolveAccess().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...state, refresh };
}
`);

w("src/components/rootDashboard/navigation/rootDashboardNav.ts", `import type { IconName } from "../../AppIcon";

export type RootDashboardRouteKey =
  | "overview"
  | "platform"
  | "users"
  | "communities"
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
  for (const group of ROOT_DASHBOARD_NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return item.label;
  }
  return key;
}

export function flattenNavItems(): RootDashboardNavItem[] {
  return ROOT_DASHBOARD_NAV_GROUPS.flatMap((group) => [...group.items]);
}
`);

console.log("foundation batch A done");
