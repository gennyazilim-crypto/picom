import { useEffect, useMemo, useState } from "react";
import { radioCommunityService } from "../../services/audio/radioCommunityService";
import { communityNavigationService, type RadioCommunitySection } from "../../services/community/communityNavigationService";
import { dateTimeService } from "../../services/dateTimeService";
import type { RadioCommunityShellSnapshot, RadioSession } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { AppIcon, type IconName } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { RadioPanel } from "./RadioPanel";
import "./RadioCommunityShell.css";
import { useAudioCatalogState } from "../../hooks/useAudioCatalog";
import { RadioHostProducerPanel } from "./RadioHostProducerPanel";
import { useRadioScheduleReminders } from "../../hooks/useRadioScheduleReminders";
import { RadioScheduleCalendarLite } from "./RadioScheduleCalendarLite";

type RadioCommunityShellProps = { community: Community; currentUser: Member; canManageAudio: boolean; onOpenProfile?: (member: Member) => void };

const primarySections: readonly { id: Exclude<RadioCommunitySection, "listenerChat">; label: string; icon: IconName }[] = [
  { id: "live", label: "Live Now", icon: "microphone" },
  { id: "schedule", label: "Schedule", icon: "bell" },
  { id: "programs", label: "Shows & Programs", icon: "headphones" },
  { id: "hosts", label: "Hosts", icon: "users" },
  { id: "announcements", label: "Announcements", icon: "inbox" },
];

function RadioEmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return <div className="radio-shell-empty"><span aria-hidden="true"><AppIcon name={icon} size="xl" /></span><strong>{title}</strong><p>{body}</p></div>;
}

function RadioShellSectionHeader({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon: IconName }) {
  return (
    <header className="radio-section-header">
      <div className="radio-section-header-copy">
        <p className="radio-section-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="radio-section-header-icon" aria-hidden="true"><AppIcon name={icon} size="md" /></span>
    </header>
  );
}

function RadioShellLivePanel({
  sessions,
  reminderIds,
  getUserLabel,
  onListen,
  onToggleReminder,
}: {
  sessions: RadioSession[];
  reminderIds: ReadonlySet<string>;
  getUserLabel: (userId: string) => string;
  onListen: (session: RadioSession) => void;
  onToggleReminder: (sessionId: string) => void;
}) {
  const stats = useMemo(
    () => ({
      count: sessions.length,
      listeners: sessions.reduce((total, session) => total + session.listenerCount, 0),
    }),
    [sessions],
  );

  if (!sessions.length) {
    return (
      <section className="radio-live-section">
        <RadioShellSectionHeader eyebrow="On air" title="Live now" description="Broadcasts currently open to this community." icon="microphone" />
        <RadioEmptyState icon="microphone" title="The station is quiet" body="No broadcast is live. Scheduled shows remain available from the Schedule section." />
      </section>
    );
  }

  return (
    <section className="radio-live-section">
      <RadioShellSectionHeader eyebrow="On air" title="Live now" description="Broadcasts currently open to this community." icon="microphone" />

      <div className="radio-live-metrics" aria-label="Live broadcast summary">
        <article><strong>{stats.count}</strong><span>Live shows</span></article>
        <article><strong>{stats.listeners.toLocaleString()}</strong><span>Listeners</span></article>
        <article><strong>Now</strong><span>Broadcasting</span></article>
      </div>

      <div className="radio-live-grid">
        {sessions.map((session, index) => {
          const reminded = reminderIds.has(session.id);
          return (
            <article key={session.id} className="radio-live-card" data-tone={(index % 5) + 1}>
              <button type="button" className="radio-live-cover" aria-label={`Listen to ${session.title}`} onClick={() => onListen(session)}>
                {session.coverUrl ? <img src={session.coverUrl} alt="" /> : <AppIcon name="microphone" size="xl" />}
                <span className="radio-live-badge">Live</span>
              </button>
              <div className="radio-live-copy">
                <span className="radio-live-host">{getUserLabel(session.hostUserId)}</span>
                <h3>{session.title}</h3>
                <p>{session.description}</p>
                <div className="radio-live-meta">
                  <span>{session.listenerCount.toLocaleString()} listening</span>
                  <span>{dateTimeService.formatCompactDateTime(session.startsAt)}</span>
                </div>
              </div>
              <div className="radio-live-actions">
                <button
                  type="button"
                  className={`radio-live-save${reminded ? " is-active" : ""}`}
                  aria-label={reminded ? `Remove reminder for ${session.title}` : `Save reminder for ${session.title}`}
                  title={reminded ? "Reminder set" : "Set reminder"}
                  onClick={() => onToggleReminder(session.id)}
                >
                  <AppIcon name="bell" size="sm" />
                </button>
                <button type="button" className="radio-live-listen" onClick={() => onListen(session)}>
                  <AppIcon name="play" size="sm" />
                  Listen
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function RadioCommunityShell({ community, currentUser, canManageAudio, onOpenProfile }: RadioCommunityShellProps) {
  const { snapshot: catalog, error: catalogError, realtimeStatus } = useAudioCatalogState();
  const reminders = useRadioScheduleReminders(catalog.radioSessions);
  const [activeSection, setActiveSection] = useState<RadioCommunitySection>(() => communityNavigationService.getRadioSection(community.id));
  const [snapshot, setSnapshot] = useState<RadioCommunityShellSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<RadioSession | null>(null);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setError(null);
    setActiveSection(communityNavigationService.getRadioSection(community.id));
    setSelectedSession(null);
    void radioCommunityService.getShellSnapshot(community).then((result) => {
      if (!active) return;
      if (result.ok) {
        setSnapshot(result.data);
        const rememberedSection = communityNavigationService.getRadioSection(community.id);
        if (rememberedSection === "listenerChat" && !result.data.settings.listenerChatEnabled) {
          communityNavigationService.rememberRadioSection(community.id, "live");
          setActiveSection("live");
        }
        const rememberedSessionId = communityNavigationService.getRadioSessionId(community.id);
        const rememberedSession = result.data.sessions.find((session) => session.id === rememberedSessionId) ?? null;
        setSelectedSession(rememberedSession);
        if (rememberedSessionId && !rememberedSession) communityNavigationService.rememberRadioSession(community.id, null);
      } else setError(result.error);
    });
    return () => { active = false; };
  }, [community]);

  useEffect(() => {
    const sessions = catalog.radioSessions.filter((session) => session.communityId === community.id);
    setSnapshot((current) => current ? { ...current, sessions } : current);
    setSelectedSession((current) => current ? sessions.find((session) => session.id === current.id) ?? null : null);
  }, [catalog.radioSessions, community.id]);

  const hosts = useMemo(() => {
    const ids = new Set(snapshot?.hostUserIds ?? []);
    return community.members.filter((member) => ids.has(member.userId));
  }, [community.members, snapshot?.hostUserIds]);
  const getUserLabel = (userId: string) => community.members.find((member) => member.userId === userId)?.displayName ?? "Picom host";
  const toggleReminder = (sessionId: string) => {
    const session = catalog.radioSessions.find((candidate) => candidate.id === sessionId);
    if (session) void reminders.toggle(session);
  };
  const selectSection = (section: RadioCommunitySection) => { communityNavigationService.rememberRadioSection(community.id, section); setActiveSection(section); };
  const openSession = (session: RadioSession) => { communityNavigationService.rememberRadioSession(community.id, session.id); setSelectedSession(session); };
  const closeSession = () => { communityNavigationService.rememberRadioSession(community.id, null); setSelectedSession(null); };
  const updateManagedSession = (session: RadioSession) => {
    setSnapshot((current) => current ? { ...current, sessions: current.sessions.some((item) => item.id === session.id) ? current.sessions.map((item) => item.id === session.id ? session : item) : [session, ...current.sessions] } : current);
    setSelectedSession((current) => current?.id === session.id ? session : current);
  };

  if (selectedSession) return <RadioPanel session={selectedSession} communityName={community.name} host={community.members.find((member) => member.userId === selectedSession.hostUserId)} listeners={community.members.filter((member) => member.status !== "offline")} canHost={canManageAudio} onClose={closeSession} onOpenCommunity={closeSession} />;

  const sections = snapshot?.settings.listenerChatEnabled ? [...primarySections, { id: "listenerChat" as const, label: "Listener Chat", icon: "hash" as IconName }] : primarySections;
  const liveSessions = snapshot?.sessions.filter((session) => session.status === "live") ?? [];
  const scheduledSessions = snapshot?.sessions.filter((session) => session.status === "scheduled") ?? [];

  return <main className="radio-community-shell">
    <header className="radio-shell-header">
      <span className="radio-shell-mark" aria-hidden="true"><AppIcon name="microphone" size="xl" /></span>
      <div className="radio-shell-header-copy">
        <span className="radio-shell-eyebrow">Radio community</span>
        <h1>{community.name}</h1>
        <p>{community.description || "A dedicated Picom station for live shows, schedules, hosts, and announcements."}</p>
      </div>
      <div className="radio-shell-status">
        <span className="radio-shell-status-pill"><i />Station ready</span>
        <span className="radio-shell-status-pill">{snapshot?.settings.scheduleTimezone ?? "UTC"}</span>
        {canManageAudio ? <strong>Station manager</strong> : null}
      </div>
    </header>
    {canManageAudio && snapshot ? (
      <div className="radio-shell-desk-wrap">
        <RadioHostProducerPanel community={community} currentUser={currentUser} snapshot={snapshot} realtimeStatus={realtimeStatus} connectionError={catalogError} onSessionChanged={updateManagedSession} />
      </div>
    ) : null}
    <div className="radio-shell-layout">
      <nav className="radio-shell-navigation" aria-label={`${community.name} radio sections`}>
        <span>STATION</span>
        {sections.map((section) => <button key={section.id} type="button" className={activeSection === section.id ? "active" : ""} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => selectSection(section.id)}><AppIcon name={section.icon} size="md" /><span>{section.label}</span></button>)}
        <footer><AppIcon name="lock" size="sm" /><span>Listener Chat stays off until a station manager explicitly links a discussion channel.</span></footer>
      </nav>
      <section className="radio-shell-content" aria-live="polite">
        {error ? <div className="radio-shell-error" role="alert"><strong>Station unavailable</strong><span>{error}</span></div> : null}
        {!snapshot && !error ? <div className="radio-shell-loading" role="status"><AppIcon name="microphone" size="lg" />Loading station...</div> : null}
        {snapshot && activeSection === "live" ? <RadioShellLivePanel sessions={liveSessions} reminderIds={reminders.reminderIds} getUserLabel={getUserLabel} onListen={openSession} onToggleReminder={toggleReminder} /> : null}
        {snapshot && activeSection === "schedule" ? <section className="radio-content-section"><RadioShellSectionHeader eyebrow={snapshot.settings.scheduleTimezone} title="Schedule" description="Upcoming broadcasts use the station timezone." icon="bell" />{scheduledSessions.length ? <RadioScheduleCalendarLite sessions={scheduledSessions} timeZone={snapshot.settings.scheduleTimezone} reminderIds={reminders.reminderIds} getUserLabel={getUserLabel} onPreview={openSession} onToggleReminder={toggleReminder} reminderError={reminders.error} /> : <RadioEmptyState icon="bell" title="No broadcasts scheduled" body={`The ${snapshot.settings.scheduleTimezone} schedule is ready and currently empty.`} />}</section> : null}
        {snapshot && activeSection === "programs" ? <section className="radio-content-section"><RadioShellSectionHeader eyebrow="Program library" title="Shows & programs" description="Recurring station formats and their assigned hosts." icon="headphones" />{snapshot.programs.length ? <div className="radio-program-grid">{snapshot.programs.map((program) => <article key={program.id}><span><AppIcon name="headphones" size="lg" /></span><div><h3>{program.title}</h3><p>{program.description}</p><small>{program.hostUserId ? getUserLabel(program.hostUserId) : "Host not assigned"}</small></div></article>)}</div> : <RadioEmptyState icon="headphones" title="No programs published" body="The station starts clean; managers can define shows after assigning trusted Radio Hosts." />}</section> : null}
        {snapshot && activeSection === "hosts" ? <section className="radio-content-section"><RadioShellSectionHeader eyebrow="Mic access" title="Hosts" description="Owner and Radio Host role assignments control broadcast access." icon="users" />{hosts.length ? <div className="radio-host-grid">{hosts.map((host) => <button key={host.id} type="button" onClick={() => onOpenProfile?.(host)}><MemberAvatar member={host} size={44} /><span><strong>{host.displayName}</strong><small>{community.roles.find((role) => role.id === host.roleId)?.name ?? "Radio Host"}</small></span><AppIcon name="chevronRight" size="sm" /></button>)}</div> : <RadioEmptyState icon="users" title="No hosts assigned" body="The owner can assign the Radio Host role from community administration." />}</section> : null}
        {snapshot && activeSection === "announcements" ? <section className="radio-content-section"><RadioShellSectionHeader eyebrow="Station desk" title="Announcements" description="Official schedule changes and broadcast notices." icon="inbox" />{snapshot.announcements.length ? <div className="radio-announcement-list">{snapshot.announcements.map((announcement) => <article key={announcement.id}><AppIcon name="inbox" size="md" /><div><p>{announcement.body}</p><small>{getUserLabel(announcement.authorUserId)} · {new Date(announcement.publishedAt).toLocaleString()}</small></div></article>)}</div> : <RadioEmptyState icon="inbox" title="No station announcements" body="There are no official notices for this station yet." />}</section> : null}
        {snapshot && activeSection === "listenerChat" && snapshot.settings.listenerChatEnabled ? <section className="radio-content-section"><RadioShellSectionHeader eyebrow="Optional side channel" title="Listener chat" description="Discussion supports the broadcast but never replaces the Radio shell." icon="hash" /><div className="radio-listener-chat-state"><AppIcon name="hash" size="lg" /><div><strong>Listener discussion is enabled</strong><span>Channel access remains protected by normal channel visibility and membership rules.</span></div></div></section> : null}
      </section>
      <aside className="radio-shell-side" aria-label="Radio station context">
        <section className="radio-shell-side-card">
          <span className="radio-shell-side-eyebrow">Station snapshot</span>
          <strong>{liveSessions.length} live</strong>
          <small>{scheduledSessions.length} scheduled · {snapshot?.settings.scheduleTimezone ?? "UTC"}</small>
        </section>
        <section className="radio-shell-side-card">
          <span className="radio-shell-side-eyebrow">Host desk</span>
          {hosts.length ? hosts.slice(0, 4).map((host) => <button type="button" key={host.id} onClick={() => onOpenProfile?.(host)}><MemberAvatar member={host} size={30} /><span><strong>{host.displayName}</strong><small>{community.roles.find((role) => role.id === host.roleId)?.name ?? "Radio Host"}</small></span></button>) : <small>No hosts assigned.</small>}
        </section>
        <section className="radio-shell-side-note"><AppIcon name="lock" size="sm" /><small>Station roles and RLS remain the broadcast access boundary.</small></section>
      </aside>
    </div>
  </main>;
}
