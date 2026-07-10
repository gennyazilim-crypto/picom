import { useMemo, useState } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { adminOperationsService } from "../services/adminOperationsService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import { TrustSafetyDashboardView } from "./TrustSafetyDashboardView";
import { DiscoveryReviewQueue } from "./DiscoveryReviewQueue";
import { ProfileVerificationAdmin } from "./ProfileVerificationAdmin";
import { AdminOperationsPagedList, AdminSystemStatusV2 } from "./AdminOperationsV2Sections";
import { AbuseEventsDashboard } from "./AbuseEventsDashboard";

type SectionId = "productHealth" | "system" | "observability" | "trustSafety" | "discoveryReview" | "users" | "communities" | "reports" | "abuse" | "storage" | "realtime" | "errors";

const sections: Array<{ id: SectionId; label: string; icon: IconName }> = [
  { id: "productHealth", label: "Product health", icon: "settings" },
  { id: "system", label: "System status", icon: "settings" },
  { id: "observability", label: "Observability", icon: "search" },
  { id: "trustSafety", label: "Trust & Safety", icon: "lock" },
  { id: "discoveryReview", label: "Discovery review", icon: "search" },
  { id: "users", label: "Users overview", icon: "users" },
  { id: "communities", label: "Communities", icon: "home" },
  { id: "reports", label: "Reports", icon: "bell" },
  { id: "abuse", label: "Abuse events", icon: "lock" },
  { id: "storage", label: "Storage", icon: "image" },
  { id: "realtime", label: "Realtime", icon: "inbox" },
  { id: "errors", label: "Recent errors", icon: "close" },
];

export function AdminOperationsPanel({ access }: { access: AdminOperationsAccess }) {
  const [active, setActive] = useState<SectionId>("productHealth");
  const snapshot = useMemo(() => adminOperationsService.getSnapshot(), []);

  const content = active === "productHealth"
    ? <><div className="admin-ops-metrics"><article><span>App version</span><strong>{snapshot.productHealth.version}</strong></article><article><span>Release channel</span><strong>{snapshot.productHealth.releaseChannel}</strong></article><article><span>API status</span><strong>{snapshot.productHealth.apiStatus}</strong></article><article><span>Realtime</span><strong>{snapshot.productHealth.realtimeStatus}</strong></article><article><span>Uploads</span><strong>{snapshot.productHealth.uploadStatus}</strong></article><article><span>Voice</span><strong>{snapshot.productHealth.voiceStatus}</strong></article><article><span>Voice quality</span><strong>{snapshot.productHealth.voiceConnectionQuality}</strong></article><article><span>Voice reconnects</span><strong>{snapshot.productHealth.voiceReconnectCount}</strong></article><article><span>Voice join failures</span><strong>{snapshot.productHealth.voiceJoinFailureCount}</strong></article><article><span>Voice device errors</span><strong>{snapshot.productHealth.voiceDeviceErrorCount}</strong></article><article><span>Voice duration</span><strong>{snapshot.productHealth.voiceSessionDurationBucket}</strong></article><article><span>Recent errors</span><strong>{snapshot.productHealth.errorCount}</strong></article><article><span>Recent warnings</span><strong>{snapshot.productHealth.warningCount}</strong></article><article><span>Crash queue</span><strong>{snapshot.productHealth.crashReportCount}</strong></article></div><div className="admin-ops-detail"><strong>Privacy-safe local snapshot</strong><p>Source: {snapshot.productHealth.source}. Last network check: {snapshot.productHealth.checkedAt ? dateTimeService.formatFullTimestamp(snapshot.productHealth.checkedAt) : "Not checked"}. Statuses and counts are aggregate only and are not production SLO measurements.</p></div></>
    : active === "system"
    ? <><div className="admin-ops-metrics"><article><span>Access source</span><strong>{access.source}</strong></article><article><span>Data source</span><strong>{snapshot.dataSource}</strong></article><article><span>Network</span><strong>{snapshot.network.state}</strong></article><article><span>Supabase</span><strong>{snapshot.serviceHealth.supabase}</strong></article><article><span>LiveKit</span><strong>{snapshot.serviceHealth.liveKit}</strong></article><article><span>Release</span><strong>{snapshot.serviceHealth.version} - {snapshot.serviceHealth.releaseChannel}</strong></article></div><div className="admin-ops-detail"><strong>Safe service summary</strong><p>Supabase host: {snapshot.serviceHealth.supabaseHost ?? "Not configured"}. No credentials, tokens, private configuration, or message content are loaded.</p></div><AdminSystemStatusV2 access={access} /></>
    : active === "observability"
      ? <><div className="admin-ops-metrics"><article><span>App starts</span><strong>{snapshot.observability.appStarts}</strong></article><article><span>Auth failures</span><strong>{snapshot.observability.authFailures}</strong></article><article><span>Message failures</span><strong>{snapshot.observability.messageSendFailures}</strong></article><article><span>Realtime reconnects</span><strong>{snapshot.observability.realtimeReconnects}</strong></article><article><span>Upload failures</span><strong>{snapshot.observability.uploadFailures}</strong></article><article><span>LiveKit join failures</span><strong>{snapshot.observability.liveKitJoinFailures}</strong></article><article><span>Screen share failures</span><strong>{snapshot.observability.screenShareFailures}</strong></article><article><span>RLS denied</span><strong>{snapshot.observability.rlsDeniedErrors}</strong></article><article><span>Crash reports</span><strong>{snapshot.observability.crashReports}</strong></article><article><span>Abuse events</span><strong>{snapshot.observability.abuseEvents}</strong></article><article><span>Package</span><strong>{snapshot.observability.packageInfo}</strong></article><article><span>Platform</span><strong>{snapshot.observability.platform}</strong></article></div><div className="admin-ops-detail"><strong>Local redacted sample</strong><p>Counts use the latest {snapshot.observability.sampleWindow} in-memory log entries. No message content, user identity, token, IP address, or private channel data is included.</p></div></>
      : active === "trustSafety"
        ? <TrustSafetyDashboardView access={access} />
        : active === "discoveryReview"
          ? <DiscoveryReviewQueue access={access} />
          : active === "users"
        ? <><AdminOperationsPagedList access={access} section="users" /><ProfileVerificationAdmin access={access} /></>
        : active === "communities"
          ? <AdminOperationsPagedList access={access} section="communities" />
          : active === "reports"
            ? <AdminOperationsPagedList access={access} section="reports" />
              : active === "abuse"
                ? <AbuseEventsDashboard access={access} />
              : active === "storage"
                ? <div className="admin-ops-detail"><strong>Attachment quarantine</strong><p>{snapshot.quarantine.quarantinedCount} blocked items; {snapshot.quarantine.needsReviewCount} need restricted review. {snapshot.storageStatus}. No file path or object URL is exposed.</p></div>
                : active === "realtime"
                  ? <div className="admin-ops-detail"><strong>{snapshot.realtimeStatus}</strong><p>Browser online: {String(snapshot.network.browserOnline)} - Backend reachable: {String(snapshot.network.backendReachable)}</p></div>
                  : <div className="admin-ops-log-list">{snapshot.recentErrors.length ? snapshot.recentErrors.map((entry) => <article key={entry.id}><div><strong>{entry.message}</strong><span>{entry.source ?? "client"}</span></div><time>{dateTimeService.formatFullTimestamp(entry.timestamp)}</time></article>) : <div className="admin-ops-detail"><strong>No recent redacted errors</strong><p>Only loggingService output can appear here.</p></div>}</div>;

  return <section className="admin-operations-panel" aria-label="Restricted app admin operations"><header><div><p className="eyebrow">Restricted app operations</p><h3>Admin Operations</h3><span>App-level health only. This is separate from community administration.</span></div><em>{access.source === "development" ? "Development" : "App admin"}</em></header><div className="admin-ops-layout"><nav aria-label="Admin operation sections">{sections.map((section) => <button key={section.id} type="button" className={active === section.id ? "active" : ""} onClick={() => setActive(section.id)}><AppIcon name={section.icon} size="sm" />{section.label}</button>)}</nav><div className="admin-ops-content">{content}</div></div></section>;
}
