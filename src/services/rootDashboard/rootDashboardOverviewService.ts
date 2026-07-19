import {
  adminOperationsService,
  type AdminOperationsAccess,
  type TrustSafetySummary,
} from "../adminOperationsService";
import { rootDashboardOperationsService } from "./rootDashboardOperationsService";
import type { AdminInfrastructureStatus, AdminSystemStatusV2 } from "../../types/adminOperations";

export type UnavailableMetric = Readonly<{
  available: false;
  reason: string;
}>;

export type AvailableMetric<T> = Readonly<{
  available: true;
  data: T;
}>;

export type OptionalMetric<T> = AvailableMetric<T> | UnavailableMetric;

const NOT_DEPLOYED: UnavailableMetric = {
  available: false,
  reason: "Contract not deployed yet",
};

export type RootDashboardOverview = Readonly<{
  productHealth: OptionalMetric<{
    version: string;
    releaseChannel: string;
    apiStatus: string;
    realtimeStatus: string;
    voiceStatus: string;
    errorCount: number;
    warningCount: number;
    crashReportCount: number;
    checkedAt: string | null;
    source: string;
  }>;
  systemStatus: OptionalMetric<AdminSystemStatusV2>;
  trustSafety: OptionalMetric<TrustSafetySummary>;
  infrastructure: OptionalMetric<AdminInfrastructureStatus>;
  onlineUsers: OptionalMetric<number>;
  activeSessions: OptionalMetric<number>;
  activeVoiceRooms: OptionalMetric<number>;
  registrations: OptionalMetric<number>;
  dau: OptionalMetric<number>;
  wau: OptionalMetric<number>;
  mau: OptionalMetric<number>;
  supportBacklog: OptionalMetric<number>;
  moderationBacklog: OptionalMetric<number>;
  securityAlerts: OptionalMetric<number>;
  adPerformance: OptionalMetric<{ impressions: number; clicks: number }>;
  subscriptionSnapshot: OptionalMetric<{ active: number; mrrCents: number }>;
  currentIncidents: OptionalMetric<number>;
  recentPrivilegedActions: OptionalMetric<number>;
  loadedAt: string;
}>;

function deny(message: string): UnavailableMetric {
  return { available: false, reason: message };
}


export const rootDashboardOverviewService = {
  async loadOverview(access: AdminOperationsAccess): Promise<RootDashboardOverview> {
    if (!access.allowed || access.source === "none") {
      return {
        productHealth: deny("App admin access is required."),
        systemStatus: deny("App admin access is required."),
        trustSafety: deny("App admin access is required."),
        infrastructure: deny("App admin access is required."),
        onlineUsers: deny("App admin access is required."),
        activeSessions: deny("App admin access is required."),
        activeVoiceRooms: deny("App admin access is required."),
        registrations: deny("App admin access is required."),
        dau: deny("App admin access is required."),
        wau: deny("App admin access is required."),
        mau: deny("App admin access is required."),
        supportBacklog: deny("App admin access is required."),
        moderationBacklog: deny("App admin access is required."),
        securityAlerts: deny("App admin access is required."),
        adPerformance: deny("App admin access is required."),
        subscriptionSnapshot: deny("App admin access is required."),
        currentIncidents: deny("App admin access is required."),
        recentPrivilegedActions: deny("App admin access is required."),
        loadedAt: new Date().toISOString(),
      };
    }

    const snapshot = adminOperationsService.getSnapshot();
    const [systemResult, trustResult, infrastructureResult, metricsResult] = await Promise.all([
      adminOperationsService.getSystemStatusV2(access),
      adminOperationsService.getTrustSafetySummary(access),
      adminOperationsService.getInfrastructureStatus(access),
      rootDashboardOperationsService.getOverviewMetrics(access),
    ]);

    const metrics = metricsResult.ok ? metricsResult.data : null;

    return {
      productHealth: {
        available: true,
        data: {
          version: snapshot.productHealth.version,
          releaseChannel: snapshot.productHealth.releaseChannel,
          apiStatus: snapshot.productHealth.apiStatus,
          realtimeStatus: snapshot.productHealth.realtimeStatus,
          voiceStatus: snapshot.productHealth.voiceStatus,
          errorCount: snapshot.productHealth.errorCount,
          warningCount: snapshot.productHealth.warningCount,
          crashReportCount: snapshot.productHealth.crashReportCount,
          checkedAt: snapshot.productHealth.checkedAt,
          source: snapshot.productHealth.source,
        },
      },
      systemStatus: systemResult.ok
        ? { available: true, data: systemResult.data }
        : deny(systemResult.message),
      trustSafety: trustResult.ok
        ? { available: true, data: trustResult.data }
        : deny(trustResult.message),
      infrastructure: infrastructureResult.ok
        ? { available: true, data: infrastructureResult.data }
        : deny(infrastructureResult.message),
      onlineUsers: metrics ? { available: true, data: metrics.onlineUsers ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      activeSessions: metrics ? { available: true, data: metrics.activeSessions ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      activeVoiceRooms: metrics ? { available: true, data: metrics.activeVoiceRooms ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      registrations: metrics ? { available: true, data: metrics.registrations24h ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      dau: metrics?.analyticsAvailable && metrics.dau !== null
        ? { available: true, data: metrics.dau }
        : metrics && !metrics.analyticsAvailable
          ? deny("Analytics warehouse not available")
          : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      wau: metrics?.analyticsAvailable && metrics.wau !== null
        ? { available: true, data: metrics.wau }
        : metrics && !metrics.analyticsAvailable
          ? deny("Analytics warehouse not available")
          : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      mau: metrics?.analyticsAvailable && metrics.mau !== null
        ? { available: true, data: metrics.mau }
        : metrics && !metrics.analyticsAvailable
          ? deny("Analytics warehouse not available")
          : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      supportBacklog: metrics ? { available: true, data: metrics.supportBacklog ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      moderationBacklog: metrics ? { available: true, data: metrics.moderationBacklog ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      securityAlerts: metrics ? { available: true, data: metrics.securityAlerts24h ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      adPerformance: metrics
        ? { available: true, data: { impressions: metrics.adImpressions ?? 0, clicks: metrics.adClicks ?? 0 } }
        : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      subscriptionSnapshot: metrics
        ? { available: true, data: { active: metrics.activeSubscriptions ?? 0, mrrCents: metrics.mrrCents ?? 0 } }
        : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      currentIncidents: metrics ? { available: true, data: metrics.openIncidents ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      recentPrivilegedActions: metrics ? { available: true, data: metrics.privilegedActions24h ?? 0 } : deny(metricsResult.ok ? "Unavailable" : metricsResult.message),
      loadedAt: metrics?.checkedAt ?? new Date().toISOString(),
    };
  },
};
