import { useEffect, useMemo, useState } from "react";
import { podcastCommunityService } from "../../services/audio/podcastCommunityService";
import { audioDataSource } from "../../services/audio/audioDataSource";
import { podcastService } from "../../services/audio/podcastService";
import { communityNavigationService, type PodcastCommunitySection } from "../../services/community/communityNavigationService";
import type { PodcastCommunityShellSnapshot, PodcastEpisode } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { AppIcon, type IconName } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { PodcastEpisodeDetail } from "./PodcastEpisodeDetail";
import { PodcastEpisodeList } from "./CommunityAudioView";
import { PodcastPublisherPanel } from "./PodcastPublisherPanel";
import "./PodcastCommunityShell.css";

type PodcastCommunityShellProps = { community: Community; canPublish: boolean; canEdit: boolean; onOpenProfile?: (member: Member) => void };
const sections: readonly { id: Exclude<PodcastCommunitySection, "drafts" | "listenerDiscussion">; label: string; icon: IconName }[] = [
  { id: "episodes", label: "Episodes", icon: "play" },
  { id: "series", label: "Series", icon: "headphones" },
  { id: "hosts", label: "Hosts", icon: "users" },
  { id: "about", label: "About", icon: "inbox" },
];

function PodcastEmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return <div className="podcast-shell-empty"><span aria-hidden="true"><AppIcon name={icon} size="xl" /></span><strong>{title}</strong><p>{body}</p></div>;
}

export function PodcastCommunityShell({ community, canPublish, canEdit, onOpenProfile }: PodcastCommunityShellProps) {
  const canManage = canPublish || canEdit;
  const [activeSection, setActiveSection] = useState<PodcastCommunitySection>(() => communityNavigationService.getPodcastSection(community.id));
  const [snapshot, setSnapshot] = useState<PodcastCommunityShellSnapshot | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<PodcastEpisode | null>(null);
  const [publisherOpen, setPublisherOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setSnapshot(null); setError(null);
    const rememberedSection = communityNavigationService.getPodcastSection(community.id);
    setActiveSection(rememberedSection === "drafts" && !canManage ? "episodes" : rememberedSection);
    setSelectedEpisodeId(null);
    void podcastCommunityService.getShellSnapshot(community).then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.error); return; }
      setSnapshot(result.data);
      const section = communityNavigationService.getPodcastSection(community.id);
      if ((section === "drafts" && !canManage) || (section === "listenerDiscussion" && !result.data.settings.listenerDiscussionEnabled)) { communityNavigationService.rememberPodcastSection(community.id, "episodes"); setActiveSection("episodes"); }
      const rememberedId = communityNavigationService.getPodcastEpisodeId(community.id);
      const remembered = result.data.episodes.find((episode) => episode.id === rememberedId) ?? null;
      setSelectedEpisodeId(remembered?.id ?? null);
      if (rememberedId && !remembered) communityNavigationService.rememberPodcastEpisode(community.id, null);
    });
    return () => { active = false; };
  }, [canManage, community, refreshVersion]);

  useEffect(() => audioDataSource.subscribe((catalog) => {
    setSnapshot((current) => current ? { ...current, episodes: catalog.podcastEpisodes.filter((episode) => episode.communityId === community.id) } : current);
  }), [community.id]);

  const publishers = useMemo(() => { const ids = new Set(snapshot?.publisherUserIds ?? []); return community.members.filter((member) => ids.has(member.userId)); }, [community.members, snapshot?.publisherUserIds]);
  const selectedEpisode = snapshot?.episodes.find((episode) => episode.id === selectedEpisodeId) ?? null;
  const savedIds = useMemo(() => new Set((snapshot?.episodes ?? []).filter((episode) => episode.isSavedByCurrentUser).map((episode) => episode.id)), [snapshot?.episodes]);
  const getUserLabel = (userId: string) => community.members.find((member) => member.userId === userId)?.displayName ?? "Picom creator";
  const toggleSaved = (id: string) => {
    const episode = snapshot?.episodes.find((candidate) => candidate.id === id);
    if (!episode) return;
    setError(null);
    const action = episode.isSavedByCurrentUser ? podcastService.unsavePodcastEpisode(id) : podcastService.savePodcastEpisode(id);
    void action.then((result) => { if (!result.ok) setError(result.error.message); });
  };
  const selectSection = (section: PodcastCommunitySection) => { communityNavigationService.rememberPodcastSection(community.id, section); setActiveSection(section); };
  const openEpisode = (episode: PodcastEpisode) => { communityNavigationService.rememberPodcastEpisode(community.id, episode.id); setSelectedEpisodeId(episode.id); };
  const closeEpisode = () => { communityNavigationService.rememberPodcastEpisode(community.id, null); setSelectedEpisodeId(null); };
  const openPublisher = (episode: PodcastEpisode | null) => { setEditingEpisode(episode); setPublisherOpen(true); };
  const closePublisher = () => { setPublisherOpen(false); setEditingEpisode(null); };
  const handlePublishingChange = (episode?: PodcastEpisode) => {
    setSnapshot((current) => !current ? current : episode ? { ...current, episodes: current.episodes.some((item) => item.id === episode.id) ? current.episodes.map((item) => item.id === episode.id ? episode : item) : [episode, ...current.episodes] } : { ...current, episodes: current.episodes.filter((item) => item.id !== editingEpisode?.id) });
    setRefreshVersion((value) => value + 1);
  };

  if (publisherOpen && snapshot && canManage) return <main className="podcast-community-shell"><PodcastPublisherPanel communityId={community.id} episode={editingEpisode} series={snapshot.series} canPublish={canPublish} onClose={closePublisher} onChanged={handlePublishingChange} /></main>;
  if (selectedEpisode && snapshot) {
    const author = community.members.find((member) => member.userId === selectedEpisode.authorUserId);
    return <PodcastEpisodeDetail episode={selectedEpisode} communityName={community.name} author={author} relatedEpisodes={[...snapshot.episodes]} getCommentAuthorLabel={getUserLabel} onClose={closeEpisode} onOpenCommunity={closeEpisode} onOpenAuthor={author && onOpenProfile ? (_event, member) => onOpenProfile(member) : undefined} onSelectEpisode={openEpisode} />;
  }

  const navigation = [sections[0], sections[1], ...(canManage ? [{ id: "drafts" as const, label: "Drafts", icon: "edit" as IconName }] : []), sections[2], sections[3], ...(snapshot?.settings.listenerDiscussionEnabled ? [{ id: "listenerDiscussion" as const, label: "Listener Discussion", icon: "hash" as IconName }] : [])];
  const published = snapshot?.episodes.filter((episode) => episode.status === "published") ?? [];
  const privateEpisodes = snapshot?.episodes.filter((episode) => episode.status !== "published") ?? [];

  return <main className="podcast-community-shell">
    <header className="podcast-shell-header"><span className="podcast-shell-mark" aria-hidden="true"><AppIcon name="headphones" size="xl" /></span><div><span className="eyebrow">Podcast community</span><h1>{community.name}</h1><p>{community.description || "A dedicated Picom library for episodes, series, creators, and listeners."}</p></div><div className="podcast-shell-status"><AppIcon name="lock" size="sm" /><span>Private media storage</span>{canPublish ? <strong>Publishing access</strong> : canEdit ? <strong>Editor access</strong> : <small>Listener access</small>}{canPublish ? <button type="button" onClick={() => openPublisher(null)}><AppIcon name="plus" size="sm" />New episode</button> : null}</div></header>
    <div className="podcast-shell-layout">
      <nav className="podcast-shell-navigation" aria-label={community.name + " podcast sections"}><span>LIBRARY</span>{navigation.map((section) => <button key={section.id} type="button" className={activeSection===section.id?"active":""} aria-current={activeSection===section.id?"page":undefined} onClick={() => selectSection(section.id)}><AppIcon name={section.icon} size="md" /><span>{section.label}</span></button>)}<footer><AppIcon name="lock" size="sm" /><span>Listener Discussion is secondary and stays hidden until a protected channel is explicitly linked.</span></footer></nav>
      <section className="podcast-shell-content" aria-live="polite">
        {error ? <div className="podcast-shell-error" role="alert"><strong>Library unavailable</strong><span>{error}</span></div> : null}
        {!snapshot&&!error ? <div className="podcast-shell-loading" role="status"><AppIcon name="headphones" size="lg" />Loading podcast library...</div> : null}
        {snapshot&&activeSection==="episodes" ? <section><div className="podcast-shell-section-heading"><div><span>ON DEMAND</span><h2>Episodes</h2></div><p>Published audio available to this community.</p></div>{published.length ? <><PodcastEpisodeList episodes={published} savedIds={savedIds} getUserLabel={getUserLabel} onPlay={openEpisode} onToggleSaved={toggleSaved} />{canManage ? <div className="podcast-published-management">{published.map((episode) => <button type="button" key={episode.id} onClick={() => openPublisher(episode)}><AppIcon name="edit" size="sm" /><span><strong>{episode.title}</strong><small>Manage published episode</small></span><AppIcon name="chevronRight" size="xs" /></button>)}</div> : null}</> : <PodcastEmptyState icon="play" title="No episodes published" body="Nothing appears here until a permitted Publisher completes the real publishing flow." />}</section> : null}
        {snapshot&&activeSection==="series" ? <section><div className="podcast-shell-section-heading"><div><span>COLLECTIONS</span><h2>Series</h2></div><p>Organized shows across the Podcast community.</p></div>{snapshot.series.length ? <div className="podcast-series-grid">{snapshot.series.map((series) => <article key={series.id}><span><AppIcon name="headphones" size="lg" /></span><div><h3>{series.title}</h3><p>{series.description}</p><small>{snapshot.episodes.filter((episode)=>episode.seriesId===series.id&&episode.status==="published").length} published episodes</small></div></article>)}</div> : <PodcastEmptyState icon="headphones" title="No series created" body="Publishers can organize episodes into original series." />}</section> : null}
        {snapshot&&activeSection==="drafts"&&canManage ? <section><div className="podcast-shell-section-heading"><div><span>PRIVATE WORKSPACE</span><h2>Drafts & archive</h2></div><p>Only permitted Publishers and Editors can see unpublished work.</p></div>{privateEpisodes.length ? <div className="podcast-draft-list">{privateEpisodes.map((episode) => <article key={episode.id}><span><AppIcon name="edit" size="md" /></span><div><strong>{episode.title}</strong><p>{episode.description}</p><small>{getUserLabel(episode.authorUserId)} · {episode.status === "archived" ? "Archived" : "Not published"}</small></div><button type="button" onClick={() => openPublisher(episode)}>Edit<AppIcon name="chevronRight" size="xs" /></button></article>)}</div> : <PodcastEmptyState icon="edit" title="No private drafts" body="Create a real draft to begin the validated publishing workflow." />}</section> : null}
        {snapshot&&activeSection==="hosts" ? <section><div className="podcast-shell-section-heading"><div><span>CREATOR ACCESS</span><h2>Hosts</h2></div><p>Owner, Publisher, and Editor assignments shape the production team.</p></div>{publishers.length ? <div className="podcast-host-grid">{publishers.map((publisher) => <button key={publisher.id} type="button" onClick={() => onOpenProfile?.(publisher)}><MemberAvatar member={publisher} size={44} /><span><strong>{publisher.displayName}</strong><small>{community.roles.find((role)=>role.id===publisher.roleId)?.name??"Podcast creator"}</small></span><AppIcon name="chevronRight" size="sm" /></button>)}</div> : <PodcastEmptyState icon="users" title="No creators assigned" body="The owner can assign Publisher and Editor roles from community administration." />}</section> : null}
        {snapshot&&activeSection==="about" ? <section><div className="podcast-shell-section-heading"><div><span>ABOUT THE SHOW</span><h2>About</h2></div><p>Public context for listeners and collaborators.</p></div><article className="podcast-about-card"><span><AppIcon name="inbox" size="xl" /></span><div><h3>{community.name}</h3><p>{snapshot.settings.about}</p><small>{published.length} episodes · {snapshot.series.length} series · {publishers.length} creators</small></div></article></section> : null}
        {snapshot&&activeSection==="listenerDiscussion"&&snapshot.settings.listenerDiscussionEnabled ? <section><div className="podcast-shell-section-heading"><div><span>OPTIONAL SIDE CHANNEL</span><h2>Listener Discussion</h2></div><p>Discussion supports episodes but never replaces the Podcast library.</p></div><div className="podcast-discussion-state"><AppIcon name="hash" size="lg" /><div><strong>Listener Discussion is enabled</strong><span>Channel visibility and membership policies remain the access boundary.</span></div></div></section> : null}
      </section>
      <aside className="podcast-shell-side" aria-label="Podcast library context"><section><span>LIBRARY</span><strong>{published.length} episodes</strong><small>{snapshot?.series.length??0} series · {privateEpisodes.length} private drafts/archive</small></section><section><span>PUBLISHING TEAM</span>{publishers.length?publishers.slice(0,4).map((publisher)=><button type="button" key={publisher.id} onClick={()=>onOpenProfile?.(publisher)}><MemberAvatar member={publisher} size={30}/><span><strong>{publisher.displayName}</strong><small>{community.roles.find((role)=>role.id===publisher.roleId)?.name??"Podcast creator"}</small></span></button>):<small>No publishers assigned.</small>}</section><section className="podcast-shell-side-note"><AppIcon name="lock" size="sm" /><small>Drafts and private media remain protected by publishing roles and RLS.</small></section></aside>
    </div>
  </main>;
}
