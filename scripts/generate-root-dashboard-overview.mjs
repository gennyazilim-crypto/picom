import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("src/services/rootDashboard/rootDashboardOverviewService.ts", `import { adminOperationsService, type TrustSafetySummary } from "../adminOperationsService";
import { appConfig } from "../../config/appConfig";
import { networkStatusService } from "../networkStatusService";
import type { AdminInfrastructureStatus } from "../../types/adminOperations";

export type OverviewMetric =
  | Readonly<{ available: true; value: number | string; freshAt: string }>
  | Readonly<{ available: false; reason: string }>;

export type RootDashboardOverview = Readonly<{
  checkedAt: string;
  productVersion: OverviewMetric;
  apiStatus: OverviewMetric;
  realtimeStatus: OverviewMetric;
  voiceStatus: OverviewMetric;
  openReports: OverviewMetric;
  abuseEvents: OverviewMetric;
  pendingUploadReviews: OverviewMetric;
  infrastructure: OverviewMetric;
  dau: OverviewMetric;
  supportBacklog: OverviewMetric;
  adPerformance: OverviewMetric;
  subscriptions: OverviewMetric;
  trustSafety: TrustSafetySummary | null;
  infrastructureStatus: AdminInfrastructureStatus | null;
}>;

function unavailable(reason: string): OverviewMetric {
  return { available: false, reason };
}

function available(value: number | string, freshAt: string): OverviewMetric {
  return { available: true, value, freshAt };
}

export const rootDashboardOverviewService = {
  async loadOverview(): Promise<RootDashboardOverview> {
    const checkedAt = new Date().toISOString();
    const [statusResult, trustResult, infraResult] = await Promise.all([
      adminOperationsService.getStatus(),
      adminOperationsService.getTrustSafetySummary().catch(() => null),
      adminOperationsService.getInfrastructureStatus?.().catch?.(() => null) ?? Promise.resolve(null),
    ]);

    const network = networkStatusService.getSnapshot?.() ?? { state: "unknown", checkedAt };

    if (!statusResult || (statusResult as { ok?: boolean }).ok === false) {
      // getStatus returns snapshot object directly in current service
    }

    const snapshot = statusResult as Awaited<ReturnType<typeof adminOperationsService.getStatus>>;
    const trust = trustResult && typeof trustResult === "object" && "ok" in (trustResult as object)
      ? ((trustResult as { ok: boolean; data?: TrustSafetySummary }).ok ? (trustResult as { data: TrustSafetySummary }).data : null)
      : (trustResult as TrustSafetySummary | null);

    let infrastructureStatus: AdminInfrastructureStatus | null = null;
    if (infraResult && typeof infraResult === "object" && "ok" in (infraResult as object)) {
      const typed = infraResult as { ok: boolean; data?: AdminInfrastructureStatus };
      infrastructureStatus = typed.ok ? typed.data ?? null : null;
    }

    return {
      checkedAt,
      productVersion: available(\`\${snapshot.productHealth?.version ?? appConfig.version}\`, checkedAt),
      apiStatus: available(snapshot.productHealth?.apiStatus ?? "unknown", checkedAt),
      realtimeStatus: available(snapshot.productHealth?.realtimeStatus ?? String(network.state ?? "unknown"), checkedAt),
      voiceStatus: available(snapshot.productHealth?.voiceStatus ?? "unknown", checkedAt),
      openReports: trust ? available(trust.openReports, trust.checkedAt) : unavailable("Trust & Safety summary unavailable"),
      abuseEvents: trust ? available(trust.abuseEvents, trust.checkedAt) : unavailable("Trust & Safety summary unavailable"),
      pendingUploadReviews: trust ? available(trust.pendingUploadReviews, trust.checkedAt) : unavailable("Upload review contract unavailable"),
      infrastructure: infrastructureStatus
        ? available(infrastructureStatus.overall ?? "checked", infrastructureStatus.checkedAt)
        : unavailable("Infrastructure health contract not deployed or denied"),
      dau: unavailable("Growth analytics contract not deployed yet"),
      supportBacklog: unavailable("Support center contract not deployed yet"),
      adPerformance: unavailable("Advertising analytics contract not deployed yet"),
      subscriptions: unavailable("Revenue/subscription contract not deployed yet"),
      trustSafety: trust,
      infrastructureStatus,
    };
  },
};
`);

// Fix overview service - need to check actual adminOperationsService methods
console.log("will fix overview after inspecting service methods");
