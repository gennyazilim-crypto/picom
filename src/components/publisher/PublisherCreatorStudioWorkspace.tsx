import { useEffect, useState } from "react";
import { localizationService } from "../../services/localizationService";
import { featureFlagService } from "../../services/featureFlagService";
import { sessionManagementService, type SessionDeviceSummary } from "../../services/sessionManagementService";
import {
  publisherStudioService,
  type PublisherStudioContext,
} from "../../services/publisher/publisherStudioService";
import { translateCreatorStudio, type CreatorStudioI18nKey } from "../../services/localization/creatorStudioCatalog";
import { PublisherDashboardWorkspace } from "./PublisherDashboardWorkspace";
import { PublisherStreamsWorkspace } from "./PublisherStreamsWorkspace";
import { PublisherAnalyticsPanel } from "./PublisherAnalyticsPanel";
import { PublisherReplayArchivePanel } from "./PublisherReplayArchivePanel";
import { PublisherEarningsPanel } from "./PublisherEarningsPanel";
import "./publisherProgram.css";

type Props = Readonly<{
  onClose: () => void;
  onGoLive: () => void;
  onOpenApplication: () => void;
}>;

type StudioSection =
  | "overview"
  | "content"
  | "community"
  | "audience"
  | "earnings"
  | "team"
  | "security"
  | "settings"
  | "support"
  | "legacy";

function t(key: CreatorStudioI18nKey): string {
  return translateCreatorStudio(key, localizationService.getLanguage());
}

export function PublisherCreatorStudioWorkspace({ onClose, onGoLive, onOpenApplication }: Props) {
  const studioEnabled = featureFlagService.isEnabled("enableCreatorStudio");
  if (!studioEnabled) {
    return (
      <PublisherDashboardWorkspace
        onClose={onClose}
        onGoLive={onGoLive}
        onOpenApplication={onOpenApplication}
      />
    );
  }

  return <CreatorStudioShell onClose={onClose} onGoLive={onGoLive} onOpenApplication={onOpenApplication} />;
}

function CreatorStudioShell({ onClose, onGoLive, onOpenApplication }: Props) {
  const streamManagementEnabled = featureFlagService.isEnabled("enablePublisherStreamManagement");
  const liveChatEnabled = featureFlagService.isEnabled("enableLiveChat");
  const analyticsEnabled = featureFlagService.isEnabled("enablePublisherAnalytics");
  const replaysEnabled = featureFlagService.isEnabled("enableLiveReplays");
  const earningsEnabled = featureFlagService.isEnabled("enablePublisherEarningsDashboard");

  const [section, setSection] = useState<StudioSection>("overview");
  const [ctx, setCtx] = useState<PublisherStudioContext | null>(null);
  const [readiness, setReadiness] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [team, setTeam] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<ReadonlyArray<SessionDeviceSummary>>([]);
  const [sessionsNote, setSessionsNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("MANAGER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTokenOnce, setInviteTokenOnce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const can = (permission: string) => publisherStudioService.hasPermission(ctx, permission);

  async function refreshContext() {
    const boot = await publisherStudioService.bootstrap();
    if (!boot.ok) {
      const fallback = await publisherStudioService.getContext();
      if (!fallback.ok) {
        setError(fallback.error);
        setCtx(null);
        return;
      }
      setCtx(fallback.data);
      setError(null);
      return;
    }
    setCtx(boot.data);
    setError(null);
  }

  useEffect(() => {
    void (async () => {
      await refreshContext();
      const ready = await publisherStudioService.getReadiness();
      if (ready.ok) setReadiness(ready.items);
    })();
  }, []);

  useEffect(() => {
    if (section !== "team" || !can("team.read")) return;
    void publisherStudioService.listTeamMembers().then((result) => {
      if (result.ok) setTeam(result.items);
      else setError(result.error);
    });
  }, [section, ctx]);

  useEffect(() => {
    if (section !== "security") return;
    if (can("audit.read") || can("security.read")) {
      void publisherStudioService.listAudit().then((result) => {
        if (result.ok) setAudit(result.items);
      });
    }
    void sessionManagementService.getActiveSessions().then((result) => {
      if (result.ok) {
        setSessions(result.data.sessions);
        setSessionsNote(result.data.message);
      } else {
        setSessions([]);
        setSessionsNote(result.message);
      }
    });
  }, [section, ctx]);

  const nav: Array<{ id: StudioSection; label: CreatorStudioI18nKey; visible: boolean }> = [
    { id: "overview", label: "studio.overview", visible: true },
    { id: "content", label: "studio.content", visible: can("streams.read") || streamManagementEnabled || replaysEnabled },
    { id: "community", label: "studio.community", visible: can("chat.read") || liveChatEnabled },
    { id: "audience", label: "studio.audience", visible: can("analytics.read") || analyticsEnabled },
    { id: "earnings", label: "studio.earnings", visible: can("finance.read") || can("monetization.read") || earningsEnabled },
    { id: "team", label: "studio.team", visible: can("team.read") },
    { id: "security", label: "studio.securityCenter", visible: can("security.read") || can("audit.read") || Boolean(ctx?.is_owner) },
    { id: "settings", label: "studio.settings", visible: can("publisher.profile.read") || Boolean(ctx?.is_owner) },
    { id: "support", label: "studio.support", visible: true },
    { id: "legacy", label: "studio.legacyDashboard", visible: true },
  ];

  async function onInvite() {
    if (!can("team.manage")) {
      setError(t("studio.noPermission"));
      return;
    }
    if (inviteRole === "FINANCE_MANAGER") {
      // Explicit UX warning; server still enforces roles.manage/owner.
      // eslint-disable-next-line no-alert
      if (!window.confirm(t("studio.financeWarning"))) return;
    }
    setBusy(true);
    const result = await publisherStudioService.createInvitation({
      roleKey: inviteRole,
      inviteeEmail: inviteEmail.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInviteTokenOnce(result.plaintextTokenOnce);
    setInviteEmail("");
    const members = await publisherStudioService.listTeamMembers();
    if (members.ok) setTeam(members.items);
  }

  async function onRemove(memberUserId: string) {
    if (!can("team.manage")) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t("studio.confirmRemoveMember"))) return;
    const result = await publisherStudioService.removeMember(memberUserId);
    if (!result.ok) setError(result.error);
    else {
      const members = await publisherStudioService.listTeamMembers();
      if (members.ok) setTeam(members.items);
      await refreshContext();
    }
  }

  if (!ctx) {
    return (
      <section className="publisher-program-shell" aria-busy="true" aria-label={t("studio.title")}>
        <p>{error ?? t("studio.loading")}</p>
        <button type="button" className="publisher-ghost" onClick={onClose}>{t("studio.settings")}</button>
      </section>
    );
  }

  if (!ctx.has_studio_access) {
    return (
      <section className="publisher-program-shell" aria-label={t("studio.title")}>
        <header className="publisher-program-header">
          <div>
            <h1>{t("studio.title")}</h1>
            <p>{t("studio.setupRequired")}</p>
          </div>
          <button type="button" className="publisher-primary" onClick={onOpenApplication}>{t("studio.setupRequired")}</button>
          <button type="button" className="publisher-ghost" onClick={onClose}>Close</button>
        </header>
      </section>
    );
  }

  return (
    <section className="publisher-program-shell" aria-label={t("studio.title")}>
      <header className="publisher-program-header">
        <div>
          <p className="publisher-eyebrow">{t("studio.title")}</p>
          <h1>{t("studio.title")}</h1>
          <p>
            {ctx.role_key ?? "—"} · {ctx.is_owner ? "OWNER" : ctx.membership_status}
          </p>
        </div>
        <div className="publisher-header-actions">
          <button type="button" className="publisher-ghost" onClick={() => void refreshContext()}>
            {t("studio.refreshPermissions")}
          </button>
          <button type="button" className="publisher-primary" onClick={onGoLive} disabled={!can("streams.go_live") && !ctx.is_owner}>
            Go Live
          </button>
          <button type="button" className="publisher-ghost" onClick={onClose}>Close</button>
        </div>
      </header>

      <nav className="publisher-tabs" aria-label={t("studio.title")}>
        {nav.filter((item) => item.visible).map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "is-active" : ""}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => setSection(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {error ? <p className="publisher-error" role="alert">{error}</p> : null}

      {section === "overview" ? (
        <div className="publisher-card">
          <h2>{t("studio.readiness")}</h2>
          <ul className="publisher-list">
            {readiness.map((item) => (
              <li key={String(item.id)}>
                <strong>{String(item.id)}</strong>: {String(item.state)}
                {item.note ? ` — ${String(item.note)}` : ""}
              </li>
            ))}
          </ul>
          {!earningsEnabled ? <p>{t("studio.featureUnavailable")} (earnings)</p> : null}
          {!analyticsEnabled ? <p>{t("studio.featureUnavailable")} (analytics)</p> : null}
        </div>
      ) : null}

      {section === "content" ? (
        <div>
          {streamManagementEnabled && can("streams.read") ? (
            <PublisherStreamsWorkspace onGoLive={onGoLive} />
          ) : (
            <div className="publisher-card">
              <h2>{t("studio.content")}</h2>
              <p>{streamManagementEnabled ? t("studio.noPermission") : t("studio.featureUnavailable")}</p>
            </div>
          )}
          {replaysEnabled && can("media.read") ? <PublisherReplayArchivePanel /> : (
            <div className="publisher-card"><p>{t("studio.featureUnavailable")} (media) — LIVEKIT EGRESS / storage blocked</p></div>
          )}
        </div>
      ) : null}

      {section === "community" ? (
        <div className="publisher-card">
          <h2>{t("studio.community")}</h2>
          <p>{liveChatEnabled && can("chat.moderate") ? "Live chat moderation module available when flag ON." : t("studio.featureUnavailable")}</p>
        </div>
      ) : null}

      {section === "audience" ? (
        analyticsEnabled && can("analytics.read") ? <PublisherAnalyticsPanel /> : (
          <div className="publisher-card"><p>{t("studio.featureUnavailable")}</p></div>
        )
      ) : null}

      {section === "earnings" ? (
        can("finance.read") || can("monetization.read") || ctx.is_owner ? (
          earningsEnabled ? <PublisherEarningsPanel /> : (
            <div className="publisher-card">
              <p>{t("studio.providerNotConfigured")}</p>
              <p>{t("studio.financeAccess")}</p>
            </div>
          )
        ) : (
          <div className="publisher-card" role="status"><p>{t("studio.noPermission")}</p></div>
        )
      ) : null}

      {section === "team" ? (
        <div className="publisher-card">
          <h2>{t("studio.teamMembers")}</h2>
          <ul className="publisher-list">
            {team.map((row) => (
              <li key={String(row.id)}>
                {String(row.member_user_id)} · {String(row.role_key)} · {String(row.status)}
                {can("team.manage") && row.role_key !== "OWNER" ? (
                  <button type="button" className="publisher-ghost" onClick={() => void onRemove(String(row.member_user_id))}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {can("team.manage") ? (
            <div>
              <h3>{t("studio.inviteMember")}</h3>
              <label>
                {t("studio.roles")}
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label={t("studio.roles")}>
                  <option value="MANAGER">{t("studio.manager")}</option>
                  <option value="STREAM_MANAGER">{t("studio.streamManager")}</option>
                  <option value="MODERATOR">Moderator</option>
                  <option value="ANALYST">{t("studio.analyst")}</option>
                  <option value="FINANCE_MANAGER">{t("studio.financeManager")}</option>
                  <option value="EDITOR">Editor</option>
                </select>
              </label>
              <label>
                Email
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoComplete="email" />
              </label>
              <button type="button" className="publisher-primary" disabled={busy} onClick={() => void onInvite()}>
                {t("studio.inviteMember")}
              </button>
              {inviteTokenOnce ? (
                <p role="status">
                  In-app invite token (shown once; not emailed if SMTP rate-limited): {inviteTokenOnce.slice(0, 12)}…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {section === "security" ? (
        <div className="publisher-card">
          <h2>{t("studio.securityCenter")}</h2>
          <p>{t("studio.sessionsPartial")}</p>
          <p>{t("studio.reauthPartial")}</p>
          <h3>{t("studio.activeSessions")}</h3>
          <ul className="publisher-list">
            {sessions.map((s) => (
              <li key={s.id}>
                {s.deviceLabel} · {s.status}{s.current ? " (current)" : ""}
              </li>
            ))}
          </ul>
          <p>{sessionsNote}</p>
          <h3>{t("studio.activityLog")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Event</th>
                <th scope="col">Summary</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.created_at)}</td>
                  <td>{String(row.event_type)}</td>
                  <td>{String(row.summary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === "settings" ? (
        <div className="publisher-card">
          <h2>{t("studio.settings")}</h2>
          <p>Publisher-specific settings remain in Studio; account password/email stay in Account Center.</p>
          <button type="button" className="publisher-primary" onClick={onOpenApplication}>Publisher application</button>
        </div>
      ) : null}

      {section === "support" ? (
        <div className="publisher-card">
          <h2>{t("studio.support")}</h2>
          <p>Uses existing support/report flows when available. No fake ticket system.</p>
        </div>
      ) : null}

      {section === "legacy" ? (
        <PublisherDashboardWorkspace
          onClose={onClose}
          onGoLive={onGoLive}
          onOpenApplication={onOpenApplication}
        />
      ) : null}
    </section>
  );
}
