import { useEffect, useMemo, useState } from "react";
import type { Channel, Community, Member } from "../types/community";
import type { CommunityAccess, CommunityPermissionKey, CommunityPermissionOverrideEffect } from "../types/communityAccess";
import type { CommunityStructureSection, CommunityStructureVisibility, ManagedPermissionOverride } from "../types/communityStructure";
import { communityStructureService } from "../services/community/communityStructureService";
import { radioCommunityService } from "../services/audio/radioCommunityService";
import { podcastCommunityService } from "../services/audio/podcastCommunityService";
import { resolveChannelSidebarIcon } from "../utils/channelSidebarIcon";
import { AppIcon } from "./AppIcon";
import { CommunityMeetingRoomManagement } from "./CommunityMeetingRoomManagement";
import "./CommunityStructureManagementPanel.css";

type Props = Readonly<{
  community: Community;
  currentUser: Member;
  access: CommunityAccess;
  onCreateCategory: (name: string) => void | Promise<void>;
  onRenameCategory: (categoryId: string, name: string) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onMoveCategory: (categoryId: string, direction: "up" | "down") => void | Promise<void>;
  onCreateChannel: (categoryId: string) => void;
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (channel: Channel) => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void | Promise<void>;
}>;

const overridePermissions: readonly CommunityPermissionKey[] = ["viewChannel", "sendMessages", "uploadAttachments", "addReactions", "joinVoice", "speakInVoice"];

export function CommunityStructureManagementPanel(props: Props) {
  const { community, access } = props;
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<string | null>(null);
  const [sections, setSections] = useState<CommunityStructureSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<CommunityStructureSection | null>(null);
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({});
  const [overrideChannelId, setOverrideChannelId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<ManagedPermissionOverride[]>([]);
  const [overrideRoleId, setOverrideRoleId] = useState(community.roles.find((role) => role.name !== "Owner")?.id ?? community.roles[0]?.id ?? "");
  const [overridePermission, setOverridePermission] = useState<CommunityPermissionKey>("viewChannel");
  const [overrideEffect, setOverrideEffect] = useState<CommunityPermissionOverrideEffect | "inherit">("inherit");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  const channels = useMemo(() => community.categories.flatMap((category) => category.channels), [community.categories]);
  const canManageOverrides = access.isOwner || access.permissions.includes("managePermissionOverrides");

  useEffect(() => {
    let alive = true;
    if (community.kind === "text") { setSections([]); setSelectedSectionId(null); return () => { alive = false; }; }
    setBusy(true); setNotice(null);
    void Promise.all([
      communityStructureService.listSections(community.id, community.kind),
      community.kind === "radio" ? radioCommunityService.getShellSnapshot(community) : podcastCommunityService.getShellSnapshot(community),
    ]).then(([structure, snapshot]) => {
      if (!alive) return;
      setBusy(false);
      if (!structure.ok) { setNotice({ error: true, text: structure.error }); return; }
      setSections(structure.data);
      setSelectedSectionId((current) => structure.data.some((item) => item.id === current) ? current : structure.data[0]?.id ?? null);
      if (snapshot.ok) {
        if ("programs" in snapshot.data) {
          setContentCounts({ radio_programs: snapshot.data.programs.length, radio_schedule: snapshot.data.schedules.length, radio_hosts: snapshot.data.hostUserIds.length, radio_listener_chat: snapshot.data.settings.listenerChatEnabled ? 1 : 0 });
        } else {
          setContentCounts({ podcast_series: snapshot.data.series.length, podcast_episodes: snapshot.data.episodes.filter((item) => item.status === "published").length, podcast_drafts: snapshot.data.episodes.filter((item) => item.status === "draft").length, podcast_publishers: snapshot.data.publisherUserIds.length, podcast_listener_discussion: snapshot.data.settings.listenerDiscussionEnabled ? 1 : 0 });
        }
      }
    });
    return () => { alive = false; };
  }, [community.id, community.kind]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return; setBusy(true); setNotice(null);
    try { await action(); } finally { setBusy(false); }
  };

  const loadOverrides = async (channelId: string) => {
    setOverrideChannelId(channelId); setNotice(null);
    const result = await communityStructureService.listChannelOverrides(community.id, channelId);
    if (!result.ok) { setNotice({ error: true, text: result.error }); return; }
    setOverrides(result.data);
  };

  if (community.kind === "text") {
    return <><CommunityMeetingRoomManagement community={community} access={access} /><section className="community-structure-manager community-mgmt-card" aria-label="Text community structure management">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Text community structure</p>
          <h3>Categories and channels</h3>
          <p>Create, order, and protect the routes members use. Accessible move controls are always available.</p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true"><AppIcon name="hash" size="md" /></span>
      </header>
      {notice ? <p className={`community-mgmt-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
      <form className="structure-create-row" onSubmit={(event) => { event.preventDefault(); const name = newCategoryName.trim(); if (!name) return; void run(async () => { await props.onCreateCategory(name); setNewCategoryName(""); }); }}>
        <label className="community-mgmt-field"><span>New category</span><input className="community-mgmt-input" value={newCategoryName} maxLength={80} onChange={(event) => setNewCategoryName(event.target.value)} /></label>
        <button type="submit" className="community-mgmt-action" disabled={busy || !newCategoryName.trim()}><AppIcon name="plus" size="sm" />Add category</button>
      </form>
      <div className="structure-category-list">
        {community.categories.map((category, categoryIndex) => <article key={category.id} className="structure-category-card">
          <header>
            {editingCategoryId === category.id ? <input className="community-mgmt-input" autoFocus value={categoryName} maxLength={80} aria-label={`Rename ${category.name}`} onChange={(event) => setCategoryName(event.target.value)} /> : <div><strong>{category.name}</strong><small>{category.channels.length} channels</small></div>}
            <div className="structure-row-actions">
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon structure-move-up" disabled={busy || categoryIndex === 0} aria-label={`Move ${category.name} up`} onClick={() => void run(() => Promise.resolve(props.onMoveCategory(category.id, "up")))}><AppIcon name="chevronDown" size="sm" /></button>
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" disabled={busy || categoryIndex === community.categories.length - 1} aria-label={`Move ${category.name} down`} onClick={() => void run(() => Promise.resolve(props.onMoveCategory(category.id, "down")))}><AppIcon name="chevronDown" size="sm" /></button>
              {editingCategoryId === category.id ? <button type="button" className="community-mgmt-action" disabled={!categoryName.trim() || busy} onClick={() => void run(async () => { await props.onRenameCategory(category.id, categoryName.trim()); setEditingCategoryId(null); })}>Save</button> : <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}>Edit</button>}
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger" disabled={busy || community.categories.length <= 1} onClick={() => setPendingCategoryDelete(category.id)}><AppIcon name="trash" size="sm" />Delete</button>
            </div>
          </header>
          <div className="structure-channel-list">
            {category.channels.map((channel, channelIndex) => <div key={channel.id} className="structure-channel-row">
              <AppIcon name={resolveChannelSidebarIcon(channel)} size="sm" />
              <span><strong>{channel.name}</strong><small>{channel.type}</small></span>
              <div className="structure-row-actions">
                <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon structure-move-up" disabled={busy || channelIndex === 0} aria-label={`Move ${channel.name} up`} onClick={() => void run(() => Promise.resolve(props.onMoveChannel(category.id, channel.id, "up")))}><AppIcon name="chevronDown" size="sm" /></button>
                <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" disabled={busy || channelIndex === category.channels.length - 1} aria-label={`Move ${channel.name} down`} onClick={() => void run(() => Promise.resolve(props.onMoveChannel(category.id, channel.id, "down")))}><AppIcon name="chevronDown" size="sm" /></button>
                {canManageOverrides ? <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => void loadOverrides(channel.id)}>Access</button> : null}
                <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => props.onEditChannel(channel)}>Edit</button>
                <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger" disabled={channels.length <= 1} onClick={() => props.onDeleteChannel(channel)}>Delete</button>
              </div>
            </div>)}
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost structure-add-channel" onClick={() => props.onCreateChannel(category.id)}><AppIcon name="plus" size="sm" />Create channel in {category.name}</button>
          </div>
        </article>)}
      </div>
      {overrideChannelId && canManageOverrides ? <section className="structure-override-editor" aria-label="Channel permission overrides">
        <header><div><strong>Scoped access overrides</strong><small>Channel: {channels.find((item) => item.id === overrideChannelId)?.name}</small></div><button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" aria-label="Close access overrides" onClick={() => setOverrideChannelId(null)}><AppIcon name="close" size="sm" /></button></header>
        <div className="structure-override-form">
          <label className="community-mgmt-field"><span>Role</span><select className="community-mgmt-select" value={overrideRoleId} onChange={(event) => setOverrideRoleId(event.target.value)}>{community.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="community-mgmt-field"><span>Permission</span><select className="community-mgmt-select" value={overridePermission} onChange={(event) => setOverridePermission(event.target.value as CommunityPermissionKey)}>{overridePermissions.map((permission) => <option key={permission} value={permission}>{permission}</option>)}</select></label>
          <label className="community-mgmt-field"><span>Effect</span><select className="community-mgmt-select" value={overrideEffect} onChange={(event) => setOverrideEffect(event.target.value as CommunityPermissionOverrideEffect | "inherit")}><option value="inherit">Inherit</option><option value="allow">Allow</option><option value="deny">Deny</option></select></label>
          <button type="button" className="community-mgmt-action" disabled={busy || !overrideRoleId} onClick={() => void run(async () => { const result = await communityStructureService.setChannelOverride({ communityId: community.id, channelId: overrideChannelId, roleId: overrideRoleId, permission: overridePermission, effect: overrideEffect }); if (!result.ok) { setNotice({ error: true, text: result.error }); return; } await loadOverrides(overrideChannelId); setNotice({ error: false, text: "Channel override saved." }); })}>Save override</button>
        </div>
        <div className="structure-override-list">{overrides.length ? overrides.map((item) => <span key={`${item.roleId}:${item.permission}`}><strong>{community.roles.find((role) => role.id === item.roleId)?.name ?? "Role"}</strong>{item.permission}: {item.effect}</span>) : <p>No explicit overrides. Role permissions are inherited.</p>}</div>
      </section> : null}
      {pendingCategoryDelete ? <div className="structure-inline-confirm" role="alertdialog" aria-modal="true"><strong>Delete this category?</strong><p>Its channels move to the first remaining category so active routes remain valid.</p><footer className="community-mgmt-footer"><button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setPendingCategoryDelete(null)}>Cancel</button><button type="button" className="community-mgmt-action community-mgmt-action--danger" onClick={() => void run(async () => { await props.onDeleteCategory(pendingCategoryDelete); setPendingCategoryDelete(null); })}>Confirm delete</button></footer></div> : null}
    </section></>;
  }

  const audioKind = community.kind === "radio" ? "radio" : "podcast";
  const saveSection = async (section: CommunityStructureSection, changes: { label?: string; visibility?: CommunityStructureVisibility; isEnabled?: boolean }) => {
    const result = await communityStructureService.updateSection(section, { label: changes.label ?? section.label, visibility: changes.visibility ?? section.visibility, isEnabled: changes.isEnabled ?? section.isEnabled });
    if (!result.ok) { setNotice({ error: true, text: result.error }); return; }
    setSections((current) => current.map((item) => item.id === section.id ? result.data : item)); setNotice({ error: false, text: `${result.data.label} updated.` });
  };

  return <><CommunityMeetingRoomManagement community={community} access={access} /><section className="community-structure-manager community-mgmt-card" aria-label={`${community.kind} community structure management`}>
    <header className="community-mgmt-card-header">
      <div className="community-mgmt-card-header-copy">
        <p className="eyebrow">{community.kind} content structure</p>
        <h3>{community.kind === "radio" ? "Station sections" : "Publishing sections"}</h3>
        <p>Only compatible sections are available. Visibility and ordering persist for every member route.</p>
      </div>
      <span className="community-mgmt-card-icon" aria-hidden="true"><AppIcon name={community.kind === "radio" ? "voice" : "microphone"} size="md" /></span>
    </header>
    {notice ? <p className={`community-mgmt-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
    <div className="structure-toolbar"><span>{sections.length} configured sections</span><button type="button" className="community-mgmt-action community-mgmt-action--ghost" disabled={busy} onClick={() => void run(async () => { const result = await communityStructureService.restoreDefaultSections(community.id, audioKind); if (!result.ok) { setNotice({ error: true, text: result.error }); return; } setSections(result.data); setSelectedSectionId((current) => result.data.some((item) => item.id === current) ? current : result.data[0]?.id ?? null); setNotice({ error: false, text: "Compatible default sections restored." }); })}><AppIcon name="plus" size="sm" />Restore missing defaults</button></div>
    {busy && !sections.length ? <div className="community-mgmt-empty" role="status"><strong>Loading structure</strong><span>Fetching compatible sections for this community type.</span></div> : <div className="audio-structure-list">
      {sections.map((section, index) => <article key={section.id} className={selectedSectionId === section.id ? "active" : ""} onClick={() => setSelectedSectionId(section.id)}>
        <div className="audio-structure-icon"><AppIcon name={section.sectionType.includes("schedule") ? "inbox" : section.sectionType.includes("host") || section.sectionType.includes("publisher") ? "users" : section.sectionType.includes("chat") || section.sectionType.includes("discussion") ? "inbox" : community.kind === "radio" ? "voice" : "microphone"} size="md" /></div>
        <label className="community-mgmt-field"><span>Section label</span><input className="community-mgmt-input" value={section.label} maxLength={80} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, label: event.target.value } : item))} onBlur={() => section.label.trim() && void run(() => saveSection(section, { label: sections.find((item) => item.id === section.id)?.label }))} /></label>
        <label className="community-mgmt-field"><span>Visibility</span><select className="community-mgmt-select" value={section.visibility} disabled={busy} onChange={(event) => void run(() => saveSection(section, { visibility: event.target.value as CommunityStructureVisibility }))}><option value="public">Public</option><option value="members">Members</option><option value="managers">Managers</option></select></label>
        <div className="audio-structure-meta"><strong>{contentCounts[section.sectionType] ?? 0}</strong><small>linked items</small>{section.isRequired ? <span>Required</span> : null}</div>
        <label className="audio-structure-toggle"><input type="checkbox" checked={section.isEnabled} disabled={busy || section.isRequired} onChange={(event) => void run(() => saveSection(section, { isEnabled: event.target.checked }))} /><span>Enabled</span></label>
        <div className="structure-row-actions">
          <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon structure-move-up" disabled={busy || index === 0} aria-label={`Move ${section.label} up`} onClick={(event) => { event.stopPropagation(); void run(async () => { const result = await communityStructureService.moveSection(section, "up"); if (!result.ok) { setNotice({ error: true, text: result.error }); return; } setSections(result.data); }); }}><AppIcon name="chevronDown" size="sm" /></button>
          <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" disabled={busy || index === sections.length - 1} aria-label={`Move ${section.label} down`} onClick={(event) => { event.stopPropagation(); void run(async () => { const result = await communityStructureService.moveSection(section, "down"); if (!result.ok) { setNotice({ error: true, text: result.error }); return; } setSections(result.data); }); }}><AppIcon name="chevronDown" size="sm" /></button>
          <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger" disabled={busy || section.isRequired} title={section.isRequired ? "Required sections retain the recovery path." : undefined} onClick={(event) => { event.stopPropagation(); setPendingSectionDelete(section); }}><AppIcon name="trash" size="sm" />Delete</button>
        </div>
      </article>)}
    </div>}
    {pendingSectionDelete ? <div className="structure-inline-confirm" role="alertdialog" aria-modal="true"><strong>Delete {pendingSectionDelete.label}?</strong><p>The section can be recreated with Restore missing defaults. Linked content is retained.</p><footer className="community-mgmt-footer"><button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setPendingSectionDelete(null)}>Cancel</button><button type="button" className="community-mgmt-action community-mgmt-action--danger" onClick={() => void run(async () => { const target = pendingSectionDelete; const result = await communityStructureService.deleteSection(target); if (!result.ok) { setNotice({ error: true, text: result.error }); return; } const remaining = sections.filter((item) => item.id !== target.id).map((item, position) => ({ ...item, position })); setSections(remaining); setSelectedSectionId((current) => current === target.id ? remaining[0]?.id ?? null : current); setPendingSectionDelete(null); setNotice({ error: false, text: `${target.label} removed; linked content was retained.` }); })}>Confirm delete</button></footer></div> : null}
  </section></>;
}
