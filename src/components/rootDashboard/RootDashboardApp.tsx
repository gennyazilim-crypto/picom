import { useEffect, useMemo, useState } from "react";
import { useRootDashboardAccess } from "../../hooks/useRootDashboardAccess";
import type { NetworkState } from "../../services/networkStatusService";
import { networkStatusService } from "../../services/networkStatusService";
import {
  rootDashboardRealtimeService,
  type RootDashboardRealtimeStatus,
} from "../../services/rootDashboard/rootDashboardRealtimeService";
import type { AdminOperationsAccess } from "../../services/adminOperationsService";
import { DashboardState } from "./components/DashboardState";
import { GlobalFilterBar, defaultRootDashboardFilters, type RootDashboardFilters } from "./components/GlobalFilterBar";
import {
  AdvertisingPage,
  AdvertisingTeamPage,
  AdCreativeReviewPage,
  AnalyticsPage,
  AuditLogPage,
  CommandCenterPage,
  CommunitiesPage, SecretCommunitiesPage,
  ContentPage,
  DashboardSettingsPage,
  FeatureFlagsPage,
  FinanceApprovalPage,
  IncidentsPage,
  MessagingDmSafetyPage,
  ModerationTeamPage,
  NotificationOpsPage,
  EmailOperationsPage,
  OverviewPage,
  PlatformPage,
  PodcastOpsPage,
  RadioOpsPage,
  ReportsExportsPage,
  RevenuePage,
  RolesPermissionsPage,
  SecurityOpsPage,
  SecurityTeamPage,
  SupportCenterPage,
  SupportTeamPage,
  SystemHealthPage,
  TrustSafetyPage,
  UsersPage,
  VoiceOpsPage,
} from "./modules";
import type { RootDashboardRouteKey } from "./navigation/rootDashboardNav";
import { RootDashboardShell } from "./RootDashboardShell";
import "./rootDashboard.css";

type RootDashboardAppProps = Readonly<{
  currentUser: Readonly<{ displayName: string; username: string; email?: string }>;
  onExit: () => void;
}>;

export function RootDashboardApp({ currentUser, onExit }: RootDashboardAppProps) {
  const accessState = useRootDashboardAccess(true);
  const [route, setRoute] = useState<RootDashboardRouteKey>("overview");
  const [filters, setFilters] = useState<RootDashboardFilters>(defaultRootDashboardFilters);
  const [connectionStatus, setConnectionStatus] = useState<NetworkState>(() => networkStatusService.getSnapshot().state);
  const [realtimeStatus, setRealtimeStatus] = useState<RootDashboardRealtimeStatus>("idle");

  useEffect(() => networkStatusService.subscribe((next) => setConnectionStatus(next.state)), []);
  useEffect(() => {
    const stop = rootDashboardRealtimeService.start({ enabled: accessState.allowed });
    const unsub = rootDashboardRealtimeService.subscribe((next) => setRealtimeStatus(next.status));
    return () => {
      unsub();
      stop();
    };
  }, [accessState.allowed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setRoute("commandCenter");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const access = useMemo((): AdminOperationsAccess => ({
    allowed: accessState.allowed,
    // Server already validated root_owner / platform_role / app_admin; normalize for shared admin services.
    source: !accessState.allowed
      ? "none"
      : accessState.source === "development"
        ? "development"
        : "app_admin",
  }), [accessState.allowed, accessState.source]);

  if (accessState.status === "loading") {
    return (
      <div className="root-dashboard" style={{ display: "grid", placeItems: "center" }}>
        <DashboardState tone="loading" title="Checking Panel access" />
      </div>
    );
  }

  if (accessState.status === "denied" || !access.allowed) {
    return (
      <div className="root-dashboard" style={{ display: "grid", placeItems: "center" }}>
        <DashboardState tone="noPermission" onRetry={() => void accessState.refresh()} />
      </div>
    );
  }

  const page = (() => {
    switch (route) {
      case "overview":
        return <OverviewPage access={access} />;
      case "platform":
        return <PlatformPage />;
      case "users":
        return <UsersPage access={access} />;
      case "communities":
        return <CommunitiesPage access={access} />;
      case "secretCommunities": return <SecretCommunitiesPage />;
    case "content":
        return <ContentPage access={access} />;
      case "messaging":
        return <MessagingDmSafetyPage access={access} />;
      case "voice":
        return <VoiceOpsPage access={access} />;
      case "support":
        return <SupportCenterPage access={access} />;
      case "supportTeam":
        return <SupportTeamPage access={access} />;
      case "trustSafety":
        return <TrustSafetyPage access={access} />;
      case "moderationTeam":
        return <ModerationTeamPage access={access} />;
      case "security":
        return <SecurityOpsPage access={access} />;
      case "securityTeam":
        return <SecurityTeamPage access={access} />;
      case "advertising":
        return <AdvertisingPage access={access} />;
      case "advertisingTeam":
        return <AdvertisingTeamPage access={access} />;
      case "adCreativeReview":
        return <AdCreativeReviewPage access={access} />;
      case "revenue":
        return <RevenuePage access={access} />;
      case "financeApproval":
        return <FinanceApprovalPage access={access} />;
      case "radio":
        return <RadioOpsPage access={access} />;
      case "podcast":
        return <PodcastOpsPage access={access} />;
      case "notifications":
        return <NotificationOpsPage access={access} />;
      case "emailOperations":
        return <EmailOperationsPage />;
      case "analytics":
        return <AnalyticsPage access={access} />;
      case "systemHealth":
        return <SystemHealthPage access={access} />;
      case "incidents":
        return <IncidentsPage access={access} />;
      case "rolesPermissions":
        return <RolesPermissionsPage access={access} />;
      case "auditLogs":
        return <AuditLogPage access={access} />;
      case "featureFlags":
        return <FeatureFlagsPage access={access} />;
      case "reportsExports":
        return <ReportsExportsPage access={access} />;
      case "settings":
        return <DashboardSettingsPage access={access} />;
      case "commandCenter":
        return <CommandCenterPage access={access} onNavigate={setRoute} />;
      default:
        return <OverviewPage access={access} />;
    }
  })();

  return (
    <RootDashboardShell
      currentUser={currentUser}
      activeRoute={route}
      onNavigate={setRoute}
      onExit={onExit}
      onOpenCommandCenter={() => setRoute("commandCenter")}
      connectionStatus={realtimeStatus === "offline" ? "offline" : connectionStatus}
      filterBar={
        <GlobalFilterBar value={filters} onChange={setFilters} onSaveView={() => undefined} />
      }
    >
      {page}
    </RootDashboardShell>
  );
}
