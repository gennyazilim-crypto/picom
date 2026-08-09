import { useEffect, useState } from "react";
import { localizationService } from "../../services/localizationService";
import {
  translatePublisherProgram,
  type PublisherProgramI18nKey,
} from "../../services/localization/publisherProgramCatalog";
import { publisherProgramService } from "../../services/publisher/publisherProgramService";
import type { PublisherProgramState } from "../../services/publisher/publisherProgramTypes";
import { featureFlagService } from "../../services/featureFlagService";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { PublisherStreamsWorkspace } from "./PublisherStreamsWorkspace";
import { PublisherAnalyticsPanel } from "./PublisherAnalyticsPanel";
import { PublisherReplayArchivePanel } from "./PublisherReplayArchivePanel";
import { PublisherEarningsPanel } from "./PublisherEarningsPanel";
import { translatePublisherAnalytics } from "../../services/localization/publisherAnalyticsCatalog";
import { translatePublisherMedia } from "../../services/localization/publisherMediaCatalog";
import { translatePublisherMonetization } from "../../services/localization/publisherMonetizationCatalog";
import "./publisherProgram.css";

type Props = Readonly<{
  onClose: () => void;
  onGoLive: () => void;
  onOpenApplication: () => void;
}>;

type ScheduleRow = {
  id: string;
  title: string;
  status: string;
  scheduled_start_at: string;
  stream_type: string;
};

function t(key: PublisherProgramI18nKey, params?: Record<string, string | number>): string {
  return translatePublisherProgram(key, localizationService.getLanguage(), params);
}

export function PublisherDashboardWorkspace({ onClose, onGoLive, onOpenApplication }: Props) {
  const streamManagementEnabled = featureFlagService.isEnabled("enablePublisherStreamManagement");
  const analyticsEnabled = featureFlagService.isEnabled("enablePublisherAnalytics");
  const replaysEnabled = featureFlagService.isEnabled("enableLiveReplays");
  const earningsEnabled = featureFlagService.isEnabled("enablePublisherEarningsDashboard");
  const [state, setState] = useState<PublisherProgramState | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [section, setSection] = useState<"overview" | "streams" | "analytics" | "archive" | "earnings" | "create" | "schedule" | "settings">("overview");

  async function refresh() {
    const program = await publisherProgramService.getProgramState();
    if (!program.ok) {
      setError(program.error);
      setState(null);
      return;
    }
    setState(program.data);
    setError(null);
    const client = getSupabaseClient() as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: ScheduleRow[] | null }>;
          };
        };
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
    } | null;
    if (!client || !program.data.canBroadcast) {
      setSchedules([]);
      return;
    }
    const { data } = await client
      .from("publisher_stream_schedules")
      .select("id,title,status,scheduled_start_at,stream_type")
      .order("scheduled_start_at", { ascending: true })
      .limit(40);
    setSchedules(data ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createSchedule() {
    if (!state?.canBroadcast) return;
    const client = getSupabaseClient() as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
    } | null;
    if (!client) return;
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId || !title.trim() || !startAt) return;
    const { error: insertError } = await client.from("publisher_stream_schedules").insert({
      owner_user_id: userId,
      title: title.trim(),
      scheduled_start_at: new Date(startAt).toISOString(),
      status: "scheduled",
      visibility: "public",
      stream_type: "screen_share",
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setStartAt("");
    await refresh();
  }

  const tabLabel: Record<Exclude<typeof section, "analytics" | "archive" | "earnings">, PublisherProgramI18nKey> = {
    overview: "dash.tab.overview",
    streams: "dash.tab.streams",
    create: "dash.tab.create",
    schedule: "dash.tab.schedule",
    settings: "dash.tab.settings",
  };

  if (state && !state.canBroadcast) {
    return (
      <section className="publisher-program-shell">
        <header className="publisher-program-header">
          <div>
            <h1>{t("dash.title")}</h1>
            <p>{t("dash.gatedBody")}</p>
          </div>
          <button type="button" className="publisher-ghost" onClick={onClose}>{t("dash.close")}</button>
        </header>
        <div className="publisher-card">
          <p>{t("dash.noBroadcast")}</p>
          <button type="button" className="publisher-primary" onClick={onOpenApplication}>{t("dash.viewApplication")}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="publisher-program-shell" aria-label={t("dash.aria")}>
      <header className="publisher-program-header">
        <div>
          <p className="publisher-eyebrow">{t("dash.eyebrow")}</p>
          <h1>{state?.profile?.displayPublisherName || t("dash.fallbackName")}</h1>
          <p>
            {state?.activeBadge
              ? t("dash.badgeActive", { type: state.activeBadge.badgeType })
              : t("dash.badgeLoading")}
          </p>
        </div>
        <div className="publisher-header-actions">
          <button type="button" className="publisher-primary" onClick={onGoLive}>{t("dash.goLive")}</button>
          <button type="button" className="publisher-ghost" onClick={onClose}>{t("dash.close")}</button>
        </div>
      </header>

      <nav className="publisher-tabs" aria-label={t("dash.tabsAria")}>
        {(["overview", "streams", ...(analyticsEnabled ? (["analytics"] as const) : []), ...(replaysEnabled ? (["archive"] as const) : []), ...(earningsEnabled ? (["earnings"] as const) : []), "create", "schedule", "settings"] as const).map((key) => (
          <button key={key} type="button" className={section === key ? "is-active" : ""} onClick={() => setSection(key)}>
            {key === "analytics"
              ? translatePublisherAnalytics("analytics.title", localizationService.getLanguage())
              : key === "archive"
                ? translatePublisherMedia("media.archive", localizationService.getLanguage())
              : key === "earnings"
                ? translatePublisherMonetization("earnings.title", localizationService.getLanguage())
              : t(tabLabel[key])}
          </button>
        ))}
      </nav>

      {error ? <p className="publisher-error" role="alert">{error}</p> : null}

      {section === "overview" ? (
        <div className="publisher-card">
          <h2>{t("dash.overviewTitle")}</h2>
          <p>{t("dash.overviewBody")}</p>
          <p>{t("dash.overviewBilling")}</p>
        </div>
      ) : null}

      {section === "analytics" && analyticsEnabled ? <PublisherAnalyticsPanel /> : null}
      {section === "archive" && replaysEnabled ? <PublisherReplayArchivePanel /> : null}
      {section === "earnings" && earningsEnabled ? <PublisherEarningsPanel /> : null}

      {section === "streams" && streamManagementEnabled ? (
        <PublisherStreamsWorkspace onGoLive={onGoLive} />
      ) : null}

      {(section === "streams" && !streamManagementEnabled) || section === "schedule" ? (
        <div className="publisher-card">
          <h2>{t("dash.scheduleTitle")}</h2>
          <ul className="publisher-list">
            {schedules.map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong> · {row.status} · {new Date(row.scheduled_start_at).toLocaleString()} · {row.stream_type}
              </li>
            ))}
            {schedules.length === 0 ? <li>{t("dash.scheduleEmpty")}</li> : null}
          </ul>
        </div>
      ) : null}

      {section === "create" ? (
        <form
          className="publisher-card publisher-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createSchedule();
          }}
        >
          <h2>{t("dash.planTitle")}</h2>
          <label>
            {t("dash.planName")}
            <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={160} />
          </label>
          <label>
            {t("dash.planStart")}
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
          </label>
          <button type="submit" className="publisher-primary">{t("dash.planSubmit")}</button>
        </form>
      ) : null}

      {section === "settings" ? (
        <div className="publisher-card">
          <h2>{t("dash.settingsTitle")}</h2>
          <p>{t("dash.accountKind", { kind: state?.profile?.accountKind ?? "—" })}</p>
          <p>{t("dash.profileStatus", { status: state?.profile?.status ?? "—" })}</p>
          <button type="button" className="publisher-ghost" onClick={onOpenApplication}>{t("dash.applicationHistory")}</button>
        </div>
      ) : null}
    </section>
  );
}
