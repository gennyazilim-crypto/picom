import { useEffect, useId, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import type { Attachment, Community, Member } from "../../types/community";
import type { ProfileActivityItem, UserProfile } from "../../types/profile";
import { AppIcon } from "../AppIcon";
import {
  ProfileLeftCard,
  ProfileMainPanel,
  ProfileView,
} from "../ProfileView";
import "../ProfileView.css";
import "./BroadcasterChannelView.css";
import { dateTimeService } from "../../services/dateTimeService";
import { broadcasterChannelService } from "../../services/live/broadcasterChannelService";
import { downloadIcsFile } from "../../features/events/utils/eventIcs";
import { localizationService } from "../../services/localizationService";
import { translateLiveNow, type LiveNowI18nKey } from "../../services/localization/liveNowCatalog";
import {
  BROADCASTER_CHANNEL_TABS,
  LIVE_SCHEDULE_CATEGORIES,
  LIVE_SCHEDULE_DURATION_MAX,
  LIVE_SCHEDULE_DURATION_MIN,
  LIVE_SCHEDULE_VISIBILITIES,
  type BroadcasterChannelTabId,
  type BroadcasterLiveHero,
  type BroadcasterScheduleItem,
  type LiveBroadcastNotificationMode,
  type LiveScheduleFormInput,
  broadcasterChannelTabLabel,
  formatLiveDuration,
  parseBroadcasterChannelTab,
  scheduleBucket,
  scheduleItemToUpcomingEvent,
  shouldShowLiveHero,
  validateLiveScheduleForm,
} from "./broadcasterChannelModel";

function t(key: LiveNowI18nKey): string {
  return translateLiveNow(key, localizationService.getLanguage());
}

function notificationModeLabel(mode: LiveBroadcastNotificationMode): string {
  switch (mode) {
    case "scheduled_only":
      return t("live.now.card.notifyScheduledOnly");
    case "important_only":
      return t("live.now.card.notifyImportantOnly");
    case "off":
      return t("live.now.card.notifyOff");
    default:
      return t("live.now.card.notifyAllLive");
  }
}

export type BroadcasterChannelViewProps = {
  profile: UserProfile;
  member: Member;
  communities: Community[];
  currentUserId: string;
  initialTab?: string | null;
  onTabChange?: (tab: BroadcasterChannelTabId) => void;
  onBack: () => void;
  onToggleFollow: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onFriendAction?: (userId: string, action: "add" | "cancel" | "accept" | "remove") => void;
  onOpenActivity: (activity: ProfileActivityItem) => void;
  onOpenImage: (attachment: Attachment) => void;
  onEditProfile?: () => void;
  onRequestVerification?: () => void;
  isBlocked?: boolean;
  relationshipBusy?: boolean;
  onOpenMore?: (event: MouseEvent, profile: UserProfile) => void;
  onOpenCommunity?: (communityId: string) => void;
  onOpenBookmarks?: () => void;
  onWatchLive?: (sessionId: string) => void;
  onGoLive?: (scheduleEventId?: string | null) => void;
  onOpenStudio?: () => void;
  dataState?: "idle" | "loading" | "ready" | "error";
  dataError?: string | null;
  onRetryData?: () => void;
};

function LiveHeroCard({
  live,
  onWatch,
}: {
  live: BroadcasterLiveHero;
  onWatch?: (sessionId: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="bc-live-hero" aria-label="Live stream now">
      <div className="bc-live-hero__badge-row">
        <span className="bc-live-badge" role="status" aria-label="Live now">
          <i className="bc-live-badge__dot" aria-hidden="true" />
          LIVE
        </span>
        <span className="bc-live-hero__duration" aria-label={`Streaming for ${formatLiveDuration(live.startedAt, now)}`}>
          {formatLiveDuration(live.startedAt, now)}
        </span>
        <span className="bc-live-hero__viewers" aria-label={`${live.viewerCount} viewers`}>
          <AppIcon name="users" size="xs" aria-hidden="true" />
          {live.viewerCount.toLocaleString()}
        </span>
      </div>
      <h2 className="bc-live-hero__title">{live.title}</h2>
      <p className="bc-live-hero__meta">
        <span>{live.category}</span>
        <span aria-hidden="true">·</span>
        <span>{live.communityName}</span>
        <span aria-hidden="true">·</span>
        <span>#{live.channelName}</span>
      </p>
      {onWatch ? (
        <button type="button" className="bc-live-hero__watch" onClick={() => onWatch(live.sessionId)}>
          <AppIcon name="play" size="sm" aria-hidden="true" />
          Watch now
        </button>
      ) : null}
    </section>
  );
}

function emptyScheduleForm(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"): LiveScheduleFormInput {
  const start = new Date(Date.now() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  const localValue = new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return {
    title: "",
    description: "",
    category: "livestream",
    scheduledStartAt: localValue,
    estimatedDurationMinutes: 60,
    timezone,
    communityId: null,
    channelId: null,
    visibility: "public",
  };
}

function formFromItem(item: BroadcasterScheduleItem): LiveScheduleFormInput {
  const start = new Date(item.startsAt);
  const localValue = Number.isFinite(start.getTime())
    ? new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : emptyScheduleForm().scheduledStartAt;
  const duration = item.estimatedDurationMinutes
    ?? (item.endsAt ? Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000) : 60);
  return {
    title: item.title,
    description: item.description,
    category: item.category || "livestream",
    scheduledStartAt: localValue,
    estimatedDurationMinutes: Math.min(LIVE_SCHEDULE_DURATION_MAX, Math.max(LIVE_SCHEDULE_DURATION_MIN, duration || 60)),
    timezone: item.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    communityId: item.communityId,
    channelId: item.channelId,
    visibility: item.visibility || "public",
  };
}

function SchedulePanel({
  items,
  loading,
  error,
  isOwner,
  communities,
  onRefresh,
  onGoLive,
  mode = "full",
  onOpenFullSchedule,
}: {
  items: BroadcasterScheduleItem[];
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  communities: Community[];
  onRefresh: () => void;
  onGoLive?: (scheduleEventId?: string | null) => void;
  mode?: "full" | "preview";
  onOpenFullSchedule?: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LiveScheduleFormInput>(() => emptyScheduleForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const upcoming: BroadcasterScheduleItem[] = [];
    const liveNow: BroadcasterScheduleItem[] = [];
    const completed: BroadcasterScheduleItem[] = [];
    for (const item of items) {
      const bucket = scheduleBucket(item);
      if (bucket === "live_now") liveNow.push(item);
      else if (bucket === "completed") completed.push(item);
      else if (bucket === "upcoming") upcoming.push(item);
    }
    return { upcoming, liveNow, completed };
  }, [items]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyScheduleForm());
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (item: BroadcasterScheduleItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setFormError(null);
    setEditorOpen(true);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    const localIso = form.scheduledStartAt.includes("T")
      ? new Date(form.scheduledStartAt).toISOString()
      : form.scheduledStartAt;
    const validated = validateLiveScheduleForm({ ...form, scheduledStartAt: localIso });
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await broadcasterChannelService.upsertOwnLiveSchedule({
      eventId: editingId,
      title: validated.value.title,
      description: validated.value.description,
      startsAt: validated.value.scheduledStartAt,
      endsAt: validated.value.endsAt,
      timezone: validated.value.timezone,
      category: validated.value.category,
      visibility: validated.value.visibility,
      communityId: validated.value.communityId,
      channelId: validated.value.channelId,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setEditorOpen(false);
    onRefresh();
  };

  const cancelItem = async (item: BroadcasterScheduleItem) => {
    if (!window.confirm(`Cancel “${item.title}”?`)) return;
    setCancellingId(item.id);
    setActionError(null);
    const result = await broadcasterChannelService.cancelOwnLiveSchedule(item.id);
    setCancellingId(null);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onRefresh();
  };

  const toggleReminder = async (item: BroadcasterScheduleItem) => {
    setActionError(null);
    const result = await broadcasterChannelService.setScheduleReminder(item.id, !item.reminderSet);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onRefresh();
  };

  const downloadIcs = (item: BroadcasterScheduleItem) => {
    const upcoming = scheduleItemToUpcomingEvent(item);
    downloadIcsFile(upcoming as Parameters<typeof downloadIcsFile>[0], `${window.location.origin}/profile`);
  };

  const renderCard = (item: BroadcasterScheduleItem) => {
    const localLabel = dateTimeService.formatCompactDateTime(item.startsAt);
    const duration = item.estimatedDurationMinutes
      ?? (item.endsAt ? Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000) : null);
    return (
      <li key={item.id} className="bc-schedule-card" data-schedule-id={item.id} data-schedule-status={item.status}>
        <div>
          <strong>{item.title}</strong>
          <p>
            {localLabel}
            <span aria-hidden="true"> · </span>
            <span>Your local time</span>
            <span aria-hidden="true"> · </span>
            <span>Event TZ: {item.timezone}</span>
          </p>
          <p className="bc-schedule-card__meta">
            <span>{item.category}</span>
            {item.communityName ? <span>· {item.communityName}</span> : <span>· Personal</span>}
            {duration ? <span>· {duration} min</span> : null}
            <span>· Reminder {item.reminderSet ? "on" : "off"}</span>
          </p>
          {item.description ? <small className="bc-muted">{item.description}</small> : null}
        </div>
        <div className="bc-schedule-card__actions">
          <span className={`bc-schedule-status bc-schedule-status--${item.status}`}>{item.status}</span>
          <button type="button" className="profile-btn profile-btn--ghost" onClick={() => downloadIcs(item)}>
            Add to calendar
          </button>
          {!isOwner ? (
            <button type="button" className="profile-btn profile-btn--ghost" onClick={() => void toggleReminder(item)}>
              {item.reminderSet ? "Reminder on" : "Remind me"}
            </button>
          ) : null}
          {isOwner && item.status === "published" ? (
            <>
              <button type="button" className="profile-btn profile-btn--ghost" onClick={() => openEdit(item)}>
                Edit
              </button>
              <button
                type="button"
                className="profile-btn profile-btn--ghost"
                disabled={cancellingId === item.id}
                onClick={() => void cancelItem(item)}
              >
                {cancellingId === item.id ? "Cancelling…" : "Cancel"}
              </button>
              {onGoLive ? (
                <button type="button" className="profile-btn profile-btn--primary" onClick={() => onGoLive(item.id)}>
                  Go Live
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </li>
    );
  };

  if (loading) {
    return (
      <section className="profile-panel" aria-busy="true" data-schedule-state="loading">
        <p>Loading schedule…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="profile-panel" data-schedule-state="error" role="alert">
        <strong>Could not load schedule</strong>
        <p>{error}</p>
        <button type="button" className="profile-btn profile-btn--ghost" onClick={onRefresh}>Retry</button>
      </section>
    );
  }

  const previewItems = [...buckets.liveNow, ...buckets.upcoming].slice(0, 3);
  const hasAny = buckets.upcoming.length + buckets.liveNow.length + buckets.completed.length > 0;
  const isPreview = mode === "preview";

  return (
    <section className="profile-panel bc-schedule-panel" aria-label="Stream schedule" data-schedule-state={saving ? "saving" : cancellingId ? "cancelling" : "ready"}>
      <header className="profile-panel-header profile-panel-header--compact">
        <div>
          <h2>{isPreview ? "Up next" : "Schedule"}</h2>
          <span className="profile-panel-subtitle">{isPreview ? "Next published livestreams" : "Upcoming livestreams"}</span>
        </div>
        <div className="bc-schedule-header-actions">
          {isPreview ? (
            onOpenFullSchedule ? (
              <button type="button" className="profile-btn profile-btn--ghost" onClick={onOpenFullSchedule}>
                Full schedule
              </button>
            ) : null
          ) : (
            <>
              <button type="button" className="profile-btn profile-btn--ghost" onClick={onRefresh}>Refresh</button>
              {isOwner ? (
                <button type="button" className="profile-btn profile-btn--primary" data-testid="bc-schedule-create" onClick={openCreate}>
                  Plan stream
                </button>
              ) : null}
            </>
          )}
        </div>
      </header>

      {actionError ? <p className="bc-schedule-error" role="alert">{actionError}</p> : null}

      {!isPreview && editorOpen && isOwner ? (
        <form className="bc-schedule-form" onSubmit={(event) => void submitForm(event)} data-testid="bc-schedule-form">
          <h3>{editingId ? "Edit scheduled stream" : "Plan a livestream"}</h3>
          <label>
            Title
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={2000}
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="bc-schedule-form__row">
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                {LIVE_SCHEDULE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
              >
                {LIVE_SCHEDULE_VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>{visibility}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="bc-schedule-form__row">
            <label>
              Start
              <input
                type="datetime-local"
                required
                value={form.scheduledStartAt}
                onChange={(event) => setForm((current) => ({ ...current, scheduledStartAt: event.target.value }))}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min={LIVE_SCHEDULE_DURATION_MIN}
                max={LIVE_SCHEDULE_DURATION_MAX}
                required
                value={form.estimatedDurationMinutes}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  estimatedDurationMinutes: Number(event.target.value),
                }))}
              />
            </label>
            <label>
              Timezone
              <input
                required
                maxLength={64}
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Community (optional)
            <select
              value={form.communityId ?? ""}
              onChange={(event) => setForm((current) => ({
                ...current,
                communityId: event.target.value || null,
                channelId: null,
              }))}
            >
              <option value="">Personal / no community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          </label>
          {formError ? <p className="bc-schedule-error" role="alert">{formError}</p> : null}
          <div className="bc-schedule-form__actions">
            <button type="button" className="profile-btn profile-btn--ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
              Close
            </button>
            <button type="submit" className="profile-btn profile-btn--primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Publish schedule"}
            </button>
          </div>
        </form>
      ) : null}

      {isPreview ? (
        previewItems.length === 0 ? (
          <div className="profile-empty-state" data-schedule-state="empty">
            <AppIcon name="calendar" size="lg" />
            <strong>No upcoming streams</strong>
            <span>{isOwner ? "Open Schedule to plan your next livestream." : "Scheduled livestreams appear here when published."}</span>
            {isOwner && onOpenFullSchedule ? (
              <button type="button" className="profile-btn profile-btn--primary bc-schedule-preview-link" onClick={onOpenFullSchedule}>
                Plan on Schedule
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="bc-schedule-list">{previewItems.map(renderCard)}</ul>
        )
      ) : !hasAny ? (
        <div className="profile-empty-state" data-schedule-state="empty">
          <AppIcon name="calendar" size="lg" />
          <strong>No upcoming streams</strong>
          <span>{isOwner ? "Plan a livestream to publish it on your channel." : "Scheduled livestreams appear here when published."}</span>
        </div>
      ) : (
        <>
          {buckets.liveNow.length ? (
            <div className="bc-schedule-group">
              <h3>Live now</h3>
              <ul className="bc-schedule-list">{buckets.liveNow.map(renderCard)}</ul>
            </div>
          ) : null}
          {buckets.upcoming.length ? (
            <div className="bc-schedule-group">
              <h3>Upcoming</h3>
              <ul className="bc-schedule-list">{buckets.upcoming.map(renderCard)}</ul>
            </div>
          ) : null}
          {buckets.completed.length ? (
            <div className="bc-schedule-group">
              <h3>Completed</h3>
              <ul className="bc-schedule-list">{buckets.completed.map(renderCard)}</ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function AboutPanel({
  profile,
  channelRules,
  categories,
  socialLinks,
  privacyLocked = false,
}: {
  profile: UserProfile;
  channelRules: string;
  categories: string[];
  socialLinks: ReadonlyArray<{ label: string; url: string }>;
  privacyLocked?: boolean;
}) {
  return (
    <div className="bc-about-stack">
      <section className="profile-panel">
        <header className="profile-panel-header profile-panel-header--compact">
          <h2>About</h2>
        </header>
        {privacyLocked ? (
          <p className="bc-muted" role="status">
            This person shares a limited profile. Home, live, and schedule sections are only available to their selected audience.
          </p>
        ) : null}
        {profile.bio.trim() ? <p className="profile-bio-copy">{profile.bio}</p> : <p className="bc-muted">No bio yet.</p>}
        <dl className="bc-about-facts">
          <div>
            <dt>Language</dt>
            <dd>{privacyLocked ? "Not shared" : (profile.preferredLanguage ?? "Not shared")}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{privacyLocked || !profile.joinedAt ? "Not shared" : dateTimeService.formatCompactDateTime(profile.joinedAt)}</dd>
          </div>
        </dl>
        {!privacyLocked && categories.length ? (
          <div className="profile-tag-cloud" aria-label="Primary categories">
            {categories.map((tag) => (
              <span key={tag} className="profile-tag">{tag}</span>
            ))}
          </div>
        ) : null}
      </section>
      {!privacyLocked && channelRules ? (
        <section className="profile-panel">
          <header className="profile-panel-header profile-panel-header--compact">
            <h2>Channel rules</h2>
          </header>
          <p className="profile-bio-copy bc-rules">{channelRules}</p>
        </section>
      ) : null}
      {!privacyLocked && socialLinks.length ? (
        <section className="profile-panel">
          <header className="profile-panel-header profile-panel-header--compact">
            <h2>Links</h2>
          </header>
          <ul className="bc-social-list">
            {socialLinks.map((link) => (
              <li key={`${link.label}:${link.url}`}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function BroadcasterChannelView(props: BroadcasterChannelViewProps) {
  const {
    profile,
    member,
    communities,
    currentUserId,
    initialTab,
    onTabChange,
    onWatchLive,
    onGoLive,
    onOpenStudio,
    isBlocked = false,
    ...rest
  } = props;

  const isCurrentUser = profile.isCurrentUser ?? profile.id === currentUserId;
  const privacyLocked = Boolean(profile.privacyRestricted) && !isCurrentUser;
  const visibleTabs = privacyLocked
    ? (["about"] as const satisfies readonly BroadcasterChannelTabId[])
    : BROADCASTER_CHANNEL_TABS;
  const tabsId = useId();
  const [tab, setTab] = useState<BroadcasterChannelTabId>(() => {
    const initial = parseBroadcasterChannelTab(initialTab);
    return privacyLocked ? "about" : initial;
  });
  const [live, setLive] = useState<BroadcasterLiveHero | null>(null);
  const [schedule, setSchedule] = useState<BroadcasterScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [notifMode, setNotifMode] = useState<LiveBroadcastNotificationMode>("all_live");
  const [channelRules, setChannelRules] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<ReadonlyArray<{ label: string; url: string }>>([]);

  useEffect(() => {
    const initial = parseBroadcasterChannelTab(initialTab);
    setTab(privacyLocked ? "about" : initial);
  }, [initialTab, profile.id, privacyLocked]);

  useEffect(() => {
    if (!privacyLocked || tab === "about") return;
    setTab("about");
    onTabChange?.("about");
  }, [privacyLocked, tab, onTabChange]);

  useEffect(() => {
    if (privacyLocked) {
      setLive(null);
      setSchedule([]);
      setScheduleLoading(false);
      setScheduleError(null);
      setChannelRules("");
      setCategories([]);
      setSocialLinks([]);
      return;
    }
    let active = true;
    const load = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      const [liveResult, scheduleResult, extras, notif] = await Promise.all([
        broadcasterChannelService.getVisibleLiveForBroadcaster(profile.id),
        broadcasterChannelService.listVisibleBroadcasterSchedule(profile.id),
        broadcasterChannelService.loadChannelExtras(profile.id),
        isCurrentUser || isBlocked
          ? Promise.resolve({ ok: true as const, data: "off" as LiveBroadcastNotificationMode })
          : broadcasterChannelService.getLiveBroadcasterNotificationMode(profile.id),
      ]);
      if (!active) return;
      if (liveResult.ok) setLive(liveResult.data);
      if (scheduleResult.ok) {
        setSchedule(scheduleResult.data);
        setScheduleError(null);
      } else {
        setScheduleError(scheduleResult.error);
      }
      setScheduleLoading(false);
      if (extras.ok) {
        setChannelRules(extras.data.channelRules);
        setCategories(extras.data.primaryLiveCategories);
        setSocialLinks(extras.data.socialLinks);
      }
      if (notif.ok) setNotifMode(notif.data);
    };
    void load();
    const unsubscribeLive = broadcasterChannelService.subscribeBroadcasterLiveSession(profile.id, () => {
      void broadcasterChannelService.getVisibleLiveForBroadcaster(profile.id).then((result) => {
        if (result.ok) setLive(result.data);
      });
    });
    const unsubscribeSchedule = broadcasterChannelService.subscribeBroadcasterSchedule(profile.id, () => {
      void broadcasterChannelService.listVisibleBroadcasterSchedule(profile.id).then((result) => {
        if (!active) return;
        if (result.ok) {
          setSchedule(result.data);
          setScheduleError(null);
        }
      });
    });
    return () => {
      active = false;
      unsubscribeLive();
      unsubscribeSchedule();
    };
  }, [profile.id, isCurrentUser, isBlocked, privacyLocked]);

  const selectTab = (next: BroadcasterChannelTabId) => {
    if (privacyLocked && next !== "about") return;
    setTab(next);
    onTabChange?.(next);
  };

  const refreshSchedule = () => {
    setScheduleLoading(true);
    setScheduleError(null);
    void broadcasterChannelService.listVisibleBroadcasterSchedule(profile.id).then((result) => {
      if (result.ok) setSchedule(result.data);
      else setScheduleError(result.error);
      setScheduleLoading(false);
    });
  };

  const onNotificationChange = (mode: LiveBroadcastNotificationMode) => {
    const previous = notifMode;
    setNotifMode(mode);
    void broadcasterChannelService.setLiveBroadcasterNotificationMode(profile.id, mode).then((result) => {
      if (result.ok) setNotifMode(result.data);
      else setNotifMode(previous);
    });
  };

  const schedulePanel = (
    <SchedulePanel
      items={schedule}
      loading={scheduleLoading}
      error={scheduleError}
      isOwner={isCurrentUser}
      communities={communities}
      onRefresh={refreshSchedule}
      onGoLive={onGoLive}
    />
  );

  const showLive = !privacyLocked && shouldShowLiveHero(live);

  return (
    <main className="profile-view bc-channel-view" aria-label={`${profile.displayName} channel`}>
      <div className="profile-page-shell">
        <ProfileLeftCard
          profile={profile}
          member={member}
          isCurrentUser={isCurrentUser}
          onToggleFollow={rest.onToggleFollow}
          onMessage={rest.onMessage}
          onFriendAction={rest.onFriendAction}
          onEditProfile={rest.onEditProfile}
          onRequestVerification={rest.onRequestVerification}
          isBlocked={isBlocked}
          relationshipBusy={rest.relationshipBusy}
          onOpenMore={rest.onOpenMore}
        />
        <div className="bc-channel-main">
          {showLive ? <LiveHeroCard live={live} onWatch={onWatchLive} /> : null}

          <div className="bc-channel-chrome">
            <div className="bc-channel-chrome__row">
              <div className="bc-channel-chrome__title">
                <strong>{privacyLocked ? "About" : showLive ? "Live now" : "Channel"}</strong>
                <span>
                  {privacyLocked
                    ? "This profile is limited. Only About is available."
                    : showLive
                      ? "Viewers can join from this page"
                      : "Broadcast tools and channel sections"}
                </span>
              </div>
              {privacyLocked ? null : isCurrentUser ? (
                <div className="bc-owner-actions" role="group" aria-label="Channel owner actions">
                  {onGoLive ? (
                    <button type="button" className="profile-btn profile-btn--primary" onClick={() => onGoLive()}>
                      Go Live
                    </button>
                  ) : null}
                  {onOpenStudio && live ? (
                    <button type="button" className="profile-btn profile-btn--ghost" onClick={onOpenStudio}>
                      Creator Studio
                    </button>
                  ) : null}
                </div>
              ) : !isBlocked ? (
                <div className="bc-viewer-actions" role="group" aria-label="Channel actions">
                  {profile.isFollowing ? (
                    <label className="bc-notif-label">
                      <span>Stream notifications</span>
                      <select
                        aria-label="Stream notification preference"
                        value={notifMode}
                        onChange={(event) => onNotificationChange(event.target.value as LiveBroadcastNotificationMode)}
                      >
                        {(["all_live", "scheduled_only", "important_only", "off"] as const).map((mode) => (
                          <option key={mode} value={mode}>
                            {notificationModeLabel(mode)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="bc-tabs" role="tablist" aria-label="Channel sections">
              {visibleTabs.map((candidate) => {
                const selected = tab === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    role="tab"
                    id={`${tabsId}-${candidate}`}
                    aria-selected={selected}
                    aria-controls={`${tabsId}-panel-${candidate}`}
                    className={`bc-tab${selected ? " is-active" : ""}`}
                    onClick={() => selectTab(candidate)}
                  >
                    {broadcasterChannelTabLabel(candidate)}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-${tab}`}
            aria-labelledby={`${tabsId}-${tab}`}
            className="bc-tab-panel"
          >
            {!privacyLocked && tab === "home" ? (
              <div className="bc-home-stack">
                {showLive ? null : (
                  <section className="bc-offline-banner" aria-label="Channel offline">
                    <div className="bc-offline-banner__icon" aria-hidden="true">
                      <AppIcon name="live" size="sm" />
                    </div>
                    <div>
                      <strong>Offline</strong>
                      <p>No visible live stream right now. Check Up next for scheduled broadcasts.</p>
                    </div>
                  </section>
                )}
                <SchedulePanel
                  items={schedule}
                  loading={scheduleLoading}
                  error={scheduleError}
                  isOwner={isCurrentUser}
                  communities={communities}
                  onRefresh={refreshSchedule}
                  onGoLive={onGoLive}
                  mode="preview"
                  onOpenFullSchedule={() => selectTab("schedule")}
                />
                <div className="bc-profile-sections">
                  <ProfileMainPanel
                    profile={profile}
                    communities={communities}
                    currentUserId={currentUserId}
                    dataState={rest.dataState}
                    dataError={rest.dataError}
                    onRetryData={rest.onRetryData}
                    onOpenActivity={rest.onOpenActivity}
                    onOpenImage={rest.onOpenImage}
                    onOpenCommunity={rest.onOpenCommunity}
                    onOpenBookmarks={rest.onOpenBookmarks}
                  />
                </div>
              </div>
            ) : null}

            {!privacyLocked && tab === "live" ? (
              showLive ? (
                <section className="profile-panel" aria-label="Live stream details">
                  <header className="profile-panel-header profile-panel-header--compact">
                    <div>
                      <h2>Live</h2>
                      <span className="profile-panel-subtitle">Stream is active at the top of this channel</span>
                    </div>
                    {onWatchLive ? (
                      <button type="button" className="profile-btn profile-btn--primary" onClick={() => onWatchLive(live.sessionId)}>
                        Watch now
                      </button>
                    ) : null}
                  </header>
                  <p className="bc-muted">
                    {live.title} · {live.category} · {live.communityName} · #{live.channelName}
                  </p>
                </section>
              ) : (
                <section className="profile-panel profile-empty-state">
                  <AppIcon name="live" size="lg" />
                  <strong>Not live</strong>
                  <span>When this creator goes live on a stream you can access, it appears here.</span>
                </section>
              )
            ) : null}

            {!privacyLocked && tab === "schedule" ? schedulePanel : null}

            {tab === "about" || privacyLocked ? (
              <AboutPanel
                profile={profile}
                channelRules={privacyLocked ? "" : channelRules}
                categories={privacyLocked ? [] : categories}
                socialLinks={privacyLocked ? [] : socialLinks}
                privacyLocked={privacyLocked}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

/** Keep ProfileView import reachable for tree-shaking-friendly re-exports. */
export { ProfileView };
