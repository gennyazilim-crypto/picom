import { useEffect, useMemo, useState } from "react";
import { radioCommunityService } from "../../services/audio/radioCommunityService";
import { communityNavigationService, type RadioCommunitySection } from "../../services/community/communityNavigationService";
import type { RadioCommunityShellSnapshot, RadioSession } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { AppIcon, type IconName } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { RadioPanel } from "./RadioPanel";
import { RadioSessionList } from "./CommunityAudioView";
import "./RadioCommunityShell.css";
import { useAudioCatalogState } from "../../hooks/useAudioCatalog";
import { RadioHostProducerPanel } from "./RadioHostProducerPanel";

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

export function RadioCommunityShell({ community, currentUser, canManageAudio, onOpenProfile }: RadioCommunityShellProps) {
  const { snapshot: catalog, error: catalogError, realtimeStatus } = useAudioCatalogState();
  const [activeSection, setActiveSection] = useState<RadioCommunitySection>(() => communityNavigationService.getRadioSection(community.id));
  const [snapshot, setSnapshot] = useState<RadioCommunityShellSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<RadioSession | null>(null);
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());

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
  const toggleReminder = (sessionId: string) => setReminderIds((current) => { const next = new Set(current); if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId); return next; });
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
      <div><span className="eyebrow">Radio community</span><h1>{community.name}</h1><p>{community.description || "A dedicated Picom station for live shows, schedules, hosts, and announcements."}</p></div>
      <div className="radio-shell-status"><i />Station ready<span>{snapshot?.settings.scheduleTimezone ?? "UTC"}</span>{canManageAudio ? <strong>Station manager</strong> : null}</div>
    </header>
    {canManageAudio && snapshot ? <RadioHostProducerPanel community={community} currentUser={currentUser} snapshot={snapshot} realtimeStatus={realtimeStatus} connectionError={catalogError} onSessionChanged={updateManagedSession} /> : null}
    <div className="radio-shell-layout">
      <nav className="radio-shell-navigation" aria-label={`${community.name} radio sections`}>
        <span>STATION</span>
        {sections.map((section) => <button key={section.id} type="button" className={activeSection === section.id ? "active" : ""} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => selectSection(section.id)}><AppIcon name={section.icon} size="md" /><span>{section.label}</span></button>)}
        <footer><AppIcon name="lock" size="sm" /><span>Listener Chat stays off until a station manager explicitly links a discussion channel.</span></footer>
      </nav>
      <section className="radio-shell-content" aria-live="polite">
        {error ? <div className="radio-shell-error" role="alert"><strong>Station unavailable</strong><span>{error}</span></div> : null}
        {!snapshot && !error ? <div className="radio-shell-loading" role="status"><AppIcon name="microphone" size="lg" />Loading station...</div> : null}
        {snapshot && activeSection === "live" ? <section><div className="radio-shell-section-heading"><div><span>ON AIR</span><h2>Live Now</h2></div><p>Broadcasts currently open to this community.</p></div>{liveSessions.length ? <RadioSessionList sessions={liveSessions} reminderIds={reminderIds} getUserLabel={getUserLabel} onListen={openSession} onToggleReminder={toggleReminder} /> : <RadioEmptyState icon="microphone" title="The station is quiet" body="No broadcast is live. Scheduled shows remain available from the Schedule section." />}</section> : null}
        {snapshot && activeSection === "schedule" ? <section><div className="radio-shell-section-heading"><div><span>{snapshot.settings.scheduleTimezone}</span><h2>Schedule</h2></div><p>Upcoming broadcasts use the station timezone.</p></div>{scheduledSessions.length ? <RadioSessionList sessions={scheduledSessions} scheduled reminderIds={reminderIds} getUserLabel={getUserLabel} onListen={openSession} onToggleReminder={toggleReminder} /> : <RadioEmptyState icon="bell" title="No broadcasts scheduled" body={`The ${snapshot.settings.scheduleTimezone} schedule is ready and currently empty.`} />}</section> : null}
        {snapshot && activeSection === "programs" ? <section><div className="radio-shell-section-heading"><div><span>PROGRAM LIBRARY</span><h2>Shows & Programs</h2></div><p>Recurring station formats and their assigned hosts.</p></div>{snapshot.programs.length ? <div className="radio-program-grid">{snapshot.programs.map((program) => <article key={program.id}><span><AppIcon name="headphones" size="lg" /></span><div><h3>{program.title}</h3><p>{program.description}</p><small>{program.hostUserId ? getUserLabel(program.hostUserId) : "Host not assigned"}</small></div></article>)}</div> : <RadioEmptyState icon="headphones" title="No programs published" body="The station starts clean; managers can define shows after assigning trusted Radio Hosts." />}</section> : null}
        {snapshot && activeSection === "hosts" ? <section><div className="radio-shell-section-heading"><div><span>MIC ACCESS</span><h2>Hosts</h2></div><p>Owner and Radio Host role assignments control broadcast access.</p></div>{hosts.length ? <div className="radio-host-grid">{hosts.map((host) => <button key={host.id} type="button" onClick={() => onOpenProfile?.(host)}><MemberAvatar member={host} size={44} /><span><strong>{host.displayName}</strong><small>{community.roles.find((role) => role.id === host.roleId)?.name ?? "Radio Host"}</small></span><AppIcon name="chevronRight" size="sm" /></button>)}</div> : <RadioEmptyState icon="users" title="No hosts assigned" body="The owner can assign the Radio Host role from community administration." />}</section> : null}
        {snapshot && activeSection === "announcements" ? <section><div className="radio-shell-section-heading"><div><span>STATION DESK</span><h2>Announcements</h2></div><p>Official schedule changes and broadcast notices.</p></div>{snapshot.announcements.length ? <div className="radio-announcement-list">{snapshot.announcements.map((announcement) => <article key={announcement.id}><AppIcon name="inbox" size="md" /><div><p>{announcement.body}</p><small>{getUserLabel(announcement.authorUserId)} · {new Date(announcement.publishedAt).toLocaleString()}</small></div></article>)}</div> : <RadioEmptyState icon="inbox" title="No station announcements" body="There are no official notices for this station yet." />}</section> : null}
        {snapshot && activeSection === "listenerChat" && snapshot.settings.listenerChatEnabled ? <section><div className="radio-shell-section-heading"><div><span>OPTIONAL SIDE CHANNEL</span><h2>Listener Chat</h2></div><p>Discussion supports the broadcast but never replaces the Radio shell.</p></div><div className="radio-listener-chat-state"><AppIcon name="hash" size="lg" /><div><strong>Listener discussion is enabled</strong><span>Channel access remains protected by normal channel visibility and membership rules.</span></div></div></section> : null}
      </section>
      <aside className="radio-shell-side" aria-label="Radio station context">
        <section><span>STATION SNAPSHOT</span><strong>{liveSessions.length} live</strong><small>{scheduledSessions.length} scheduled · {snapshot?.settings.scheduleTimezone ?? "UTC"}</small></section>
        <section><span>HOST DESK</span>{hosts.length ? hosts.slice(0, 4).map((host) => <button type="button" key={host.id} onClick={() => onOpenProfile?.(host)}><MemberAvatar member={host} size={30} /><span><strong>{host.displayName}</strong><small>{community.roles.find((role) => role.id === host.roleId)?.name ?? "Radio Host"}</small></span></button>) : <small>No hosts assigned.</small>}</section>
        <section className="radio-shell-side-note"><AppIcon name="lock" size="sm" /><small>Station roles and RLS remain the broadcast access boundary.</small></section>
      </aside>
    </div>
  </main>;
}
