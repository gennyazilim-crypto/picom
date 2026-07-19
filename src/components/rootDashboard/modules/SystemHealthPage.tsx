import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminInfrastructureStatus, AdminSystemStatusV2 } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

type SystemHealthPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SystemHealthPage({ access }: SystemHealthPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<AdminSystemStatusV2 | null>(null);
  const [infra, setInfra] = useState<AdminInfrastructureStatus | null>(null);
  const snapshot = adminOperationsService.getSnapshot();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      adminOperationsService.getSystemStatusV2(access),
      adminOperationsService.getInfrastructureStatus(access),
    ]).then(([systemResult, infraResult]) => {
      if (cancelled) return;
      if (!systemResult.ok && !infraResult.ok) {
        setError(systemResult.message || infraResult.message);
      } else {
        setError(null);
      }
      setSystem(systemResult.ok ? systemResult.data : null);
      setInfra(infraResult.ok ? infraResult.data : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  if (loading) {
    return (
      <section className="rd-module" aria-label="System Health">
        <ModulePageHeader title="System Health" purpose="Infrastructure and product health for root operators." />
        <DashboardState tone="loading" title="Checking health contracts" />
      </section>
    );
  }

  return (
    <section className="rd-module" aria-label="System Health">
      <ModulePageHeader title="System Health" purpose="Infrastructure and product health for root operators." />
      {error ? <DashboardState tone="error" detail={error} /> : null}
      <div className="rd-kpi-strip" aria-label="Live product health">
        <KpiCard label="API" value={snapshot.productHealth.apiStatus} variant="realtime" freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Realtime" value={snapshot.productHealth.realtimeStatus} variant="realtime" freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Voice / LiveKit" value={snapshot.productHealth.voiceStatus} freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Uploads" value={snapshot.productHealth.uploadStatus} freshnessIso={snapshot.productHealth.checkedAt} />
      </div>
      <div className="rd-split">
        <div className="rd-kpi-section">
          <header className="rd-kpi-section__head"><span>Platform counts</span></header>
          <div className="rd-kpi-grid">
            <KpiCard label="Users" value={system?.users ?? null} unavailableReason="System status RPC unavailable" freshnessIso={system?.checkedAt} />
            <KpiCard label="Communities" value={system?.communities ?? null} unavailableReason="System status RPC unavailable" freshnessIso={system?.checkedAt} />
          </div>
        </div>
        <div className="rd-kpi-section">
          <header className="rd-kpi-section__head"><span>Infrastructure</span></header>
          <div className="rd-kpi-grid">
            <KpiCard label="Overall" value={infra?.overall ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
            <KpiCard label="Database" value={infra?.database ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
            <KpiCard label="LiveKit" value={infra?.livekit ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
            <KpiCard label="TURN" value={infra?.turn ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
          </div>
        </div>
      </div>
    </section>
  );
}
