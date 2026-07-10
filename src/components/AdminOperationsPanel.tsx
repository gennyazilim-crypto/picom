import { useMemo, useState } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { adminOperationsService } from "../services/adminOperationsService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";

type SectionId = "system" | "observability" | "users" | "communities" | "reports" | "abuse" | "storage" | "realtime" | "errors";

const sections: Array<{ id: SectionId; label: string; icon: IconName }> = [
  { id: "system", label: "System status", icon: "settings" },
  { id: "observability", label: "Observability", icon: "search" },
  { id: "users", label: "Users overview", icon: "users" },
  { id: "communities", label: "Communities", icon: "home" },
  { id: "reports", label: "Reports", icon: "bell" },
  { id: "abuse", label: "Abuse events", icon: "lock" },
  { id: "storage", label: "Storage", icon: "image" },
  { id: "realtime", label: "Realtime", icon: "inbox" },
  { id: "errors", label: "Recent errors", icon: "close" },
];

export function AdminOperationsPanel({ access }: { access: AdminOperationsAccess }) {
  const [active, setActive] = useState<SectionId>("system");
  const snapshot = useMemo(() => adminOperationsService.getSnapshot(), []);

  const content = active === "system"
    ? <div className="admin-ops-metrics"><article><span>Access source</span><strong>{access.source}</strong></article><article><span>Data source</span><strong>{snapshot.dataSource}</strong></article><article><span>Network</span><strong>{snapshot.network.state}</strong></article></div>
    : active === "observability"
      ? <><div className="admin-ops-metrics"><article><span>App starts</span><strong>{snapshot.observability.appStarts}</strong></article><article><span>Auth failures</span><strong>{snapshot.observability.authFailures}</strong></article><article><span>Message failures</span><strong>{snapshot.observability.messageSendFailures}</strong></article><article><span>Realtime reconnects</span><strong>{snapshot.observability.realtimeReconnects}</strong></article><article><span>Upload failures</span><strong>{snapshot.observability.uploadFailures}</strong></article><article><span>LiveKit join failures</span><strong>{snapshot.observability.liveKitJoinFailures}</strong></article><article><span>Screen share failures</span><strong>{snapshot.observability.screenShareFailures}</strong></article><article><span>RLS denied</span><strong>{snapshot.observability.rlsDeniedErrors}</strong></article><article><span>Crash reports</span><strong>{snapshot.observability.crashReports}</strong></article><article><span>Abuse events</span><strong>{snapshot.observability.abuseEvents}</strong></article><article><span>Package</span><strong>{snapshot.observability.packageInfo}</strong></article><article><span>Platform</span><strong>{snapshot.observability.platform}</strong></article></div><div className="admin-ops-detail"><strong>Local redacted sample</strong><p>Counts use the latest {snapshot.observability.sampleWindow} in-memory log entries. No message content, user identity, token, IP address, or private channel data is included.</p></div></>
      : active === "users"
        ? <div className="admin-ops-detail"><strong>{snapshot.visibleUsers} visible mock/local users</strong><p>Aggregate only. Passwords, sessions, email addresses, and private profile data are excluded.</p></div>
        : active === "communities"
          ? <div className="admin-ops-detail"><strong>{snapshot.visibleCommunities} visible mock/local communities</strong><p>No private message content or invite secrets are loaded into this operations summary.</p></div>
          : active === "reports"
            ? <div className="admin-ops-metrics"><article><span>Open</span><strong>{snapshot.reports.open}</strong></article><article><span>Reviewed</span><strong>{snapshot.reports.reviewed}</strong></article><article><span>Action taken</span><strong>{snapshot.reports.action_taken}</strong></article></div>
            : active === "abuse"
              ? <div className="admin-ops-detail"><strong>{snapshot.abuse.total} redacted local events</strong><p>{snapshot.abuse.critical} critical - {snapshot.abuse.warning} warnings. Raw IPs and message content are not retained.</p></div>
              : active === "storage"
                ? <div className="admin-ops-detail"><strong>{snapshot.quarantine.quarantinedCount} quarantined attachments</strong><p>{snapshot.storageStatus}. {snapshot.quarantine.needsReviewCount} items need review.</p></div>
                : active === "realtime"
                  ? <div className="admin-ops-detail"><strong>{snapshot.realtimeStatus}</strong><p>Browser online: {String(snapshot.network.browserOnline)} - Backend reachable: {String(snapshot.network.backendReachable)}</p></div>
                  : <div className="admin-ops-log-list">{snapshot.recentErrors.length ? snapshot.recentErrors.map((entry) => <article key={entry.id}><div><strong>{entry.message}</strong><span>{entry.source ?? "client"}</span></div><time>{dateTimeService.formatFullTimestamp(entry.timestamp)}</time></article>) : <div className="admin-ops-detail"><strong>No recent redacted errors</strong><p>Only loggingService output can appear here.</p></div>}</div>;

  return <section className="admin-operations-panel" aria-label="Restricted app admin operations"><header><div><p className="eyebrow">Restricted app operations</p><h3>Admin Operations</h3><span>App-level health only. This is separate from community administration.</span></div><em>{access.source === "development" ? "Development" : "App admin"}</em></header><div className="admin-ops-layout"><nav aria-label="Admin operation sections">{sections.map((section) => <button key={section.id} type="button" className={active === section.id ? "active" : ""} onClick={() => setActive(section.id)}><AppIcon name={section.icon} size="sm" />{section.label}</button>)}</nav><div className="admin-ops-content">{content}</div></div></section>;
}
