import { useMemo } from "react";
import { adminOperationsService } from "../../../services/adminOperationsService";
import { DashboardState } from "../DashboardState";
import { KpiCard } from "../KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

export function PlatformPage() {
  const snapshot = useMemo(() => adminOperationsService.getSnapshot(), []);

  return (
    <section className="rd-module" aria-label="Platform">
      <ModulePageHeader
        title="Platform"
        purpose="Client-visible product health snapshot. Deeper platform SLOs require dedicated contracts."
      />
      <div className="rd-kpi-grid">
        <KpiCard label="Version" value={snapshot.productHealth.version} />
        <KpiCard label="Channel" value={snapshot.productHealth.releaseChannel} />
        <KpiCard label="API" value={snapshot.productHealth.apiStatus} />
        <KpiCard label="Uploads" value={snapshot.productHealth.uploadStatus} />
        <KpiCard label="Voice quality" value={snapshot.productHealth.voiceConnectionQuality} />
        <KpiCard label="Data source" value={snapshot.dataSource} />
      </div>
      <DashboardState
        variant="empty"
        title="Platform SLO board unavailable"
        message="Contract not deployed yet. Latency, error-budget, and multi-region SLO strips are not wired."
      />
    </section>
  );
}
