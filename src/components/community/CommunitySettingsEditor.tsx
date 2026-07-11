import { useEffect, useState } from "react";
import type { Community } from "../../types/community";
import type { CommunityRule } from "../../types/communityRules";
import type { CommunityAccess } from "../../types/communityAccess";
import { getDefaultCommunityTypeSettings, normalizeCommunityTypeSettings, type CommunityNotificationLevel, type CommunityTypeSettings } from "../../types/communitySettings";
import { communityBrandingService } from "../../services/communityBrandingService";
import { communityRulesService } from "../../services/communityRulesService";
import { communityService, type CommunitySummary } from "../../services/communityService";
import { AppIcon } from "../AppIcon";
import "./CommunitySettingsEditor.css";

type Props = { community: Community; access: CommunityAccess; onUpdated: (community: CommunitySummary) => void };

export function CommunitySettingsEditor({ community, access, onUpdated }: Props) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [iconUrl, setIconUrl] = useState(/^https:|^data:image/i.test(community.icon) ? community.icon : "");
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? "");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">(community.visibility ?? "private");
  const [publicReadEnabled, setPublicReadEnabled] = useState(community.publicReadEnabled ?? false);
  const [defaultNotificationLevel, setDefaultNotificationLevel] = useState<CommunityNotificationLevel>(community.defaultNotificationLevel ?? "mentions");
  const [rulesEnabled, setRulesEnabled] = useState(community.rulesEnabled ?? false);
  const [rulesVersion, setRulesVersion] = useState(community.rulesVersion ?? "1");
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [typeSettings, setTypeSettings] = useState<CommunityTypeSettings>(() => normalizeCommunityTypeSettings(community.kind, community.typeSettings ?? getDefaultCommunityTypeSettings(community.kind)));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void communityRulesService.loadPublishedRules(community.id).then((result) => { if (active) setRules(result.ok ? result.rules : communityRulesService.getDefaultRules(community.id)); });
    return () => { active = false; };
  }, [community.id]);

  const updateRule = (id: string, change: Partial<Pick<CommunityRule, "title" | "body" | "required">>) => setRules((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));

  const save = async () => {
    if (!access.permissions.includes("manageCommunity")) return;
    setSaving(true); setNotice(null);
    const uploadedPaths: string[] = [];
    let nextIconUrl = iconUrl;
    let nextBannerUrl = bannerUrl;
    for (const [kind, file] of [["icon", iconFile], ["banner", bannerFile]] as const) {
      if (!file) continue;
      const uploaded = await communityBrandingService.upload(community.id, kind, file);
      if (!uploaded.ok) { setNotice(uploaded.message); setSaving(false); return; }
      if (uploaded.data.storagePath) uploadedPaths.push(uploaded.data.storagePath);
      if (kind === "icon") nextIconUrl = uploaded.data.url; else nextBannerUrl = uploaded.data.url;
    }
    const result = await communityService.updateCommunitySettings({ id: community.id, name, description, iconUrl: nextIconUrl, bannerUrl: nextBannerUrl, visibility, publicReadEnabled: visibility === "public" && publicReadEnabled, defaultNotificationLevel, rulesEnabled, rulesVersion, typeSettings, rules });
    if (!result.ok) {
      await Promise.all(uploadedPaths.map((path) => communityBrandingService.remove(path)));
      setNotice(result.error.message); setSaving(false); return;
    }
    setIconUrl(result.data.iconUrl ?? ""); setBannerUrl(result.data.bannerUrl ?? ""); setIconFile(null); setBannerFile(null);
    onUpdated(result.data); setNotice("Community identity, rules, and type settings saved."); setSaving(false);
  };

  return <div className="community-settings-form community-settings-editor">
    <div className="community-settings-brand-preview">{bannerUrl ? <img src={bannerUrl} alt="Community banner preview" /> : <div><AppIcon name="image" size="xl" /><span>Banner preview</span></div>}</div>
    <div className="community-settings-grid"><label><span>Name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><label><span>Description</span><textarea rows={4} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label></div>
    <div className="community-settings-grid"><label><span>Icon upload (PNG/JPG/WEBP, 2 MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setIconFile(event.target.files?.[0] ?? null)} /></label><label><span>Banner upload (PNG/JPG/WEBP, 6 MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)} /></label></div>
    <div className="community-settings-grid"><label><span>Visibility</span><select value={visibility} onChange={(event) => { const next = event.target.value as "public" | "private"; setVisibility(next); if (next === "private") setPublicReadEnabled(false); }}><option value="public">Public</option><option value="private">Private</option></select></label><label><span>Default notifications</span><select value={defaultNotificationLevel} onChange={(event) => setDefaultNotificationLevel(event.target.value as CommunityNotificationLevel)}><option value="all">All activity</option><option value="mentions">Mentions</option><option value="none">None</option></select></label></div>
    <label className="moderation-filter-toggle"><input type="checkbox" checked={publicReadEnabled} disabled={visibility === "private"} onChange={(event) => setPublicReadEnabled(event.target.checked)} /><span>Allow visitors to read public content</span></label>
    <section className="community-settings-subsection"><header><strong>Rules and join acceptance</strong><span>Published text appears in the visitor join confirmation.</span></header><div className="community-settings-grid"><label className="moderation-filter-toggle"><input type="checkbox" checked={rulesEnabled} onChange={(event) => setRulesEnabled(event.target.checked)} /><span>Require rules acceptance</span></label><label><span>Rules version</span><input value={rulesVersion} maxLength={32} onChange={(event) => setRulesVersion(event.target.value)} /></label></div>{rules.map((rule) => <article className="community-rule-editor" key={rule.id}><input value={rule.title} maxLength={120} aria-label="Rule title" onChange={(event) => updateRule(rule.id, { title: event.target.value })} /><textarea rows={3} value={rule.body} maxLength={2000} aria-label="Rule text" onChange={(event) => updateRule(rule.id, { body: event.target.value })} /><label className="moderation-filter-toggle"><input type="checkbox" checked={rule.required} onChange={(event) => updateRule(rule.id, { required: event.target.checked })} /><span>Required</span></label><button type="button" aria-label="Remove rule" disabled={rules.length <= 1} onClick={() => setRules((items) => items.filter((item) => item.id !== rule.id))}><AppIcon name="trash" size="sm" /></button></article>)}<button type="button" disabled={rules.length >= 10} onClick={() => setRules((items) => [...items, { id: `draft-${crypto.randomUUID()}`, communityId: community.id, title: "New rule", body: "Describe the expected community behavior.", required: true, position: items.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])}><AppIcon name="plus" size="sm" />Add rule</button></section>
    <section className="community-settings-subsection"><header><strong>{community.kind === "text" ? "Text defaults" : community.kind === "radio" ? "Radio defaults" : "Podcast defaults"}</strong><span>These settings are enforced by the matching service and RLS paths.</span></header>{typeSettings.kind === "text" ? <><label><span>Maximum message length</span><input type="number" min={250} max={4000} value={typeSettings.maxMessageLength} onChange={(event) => setTypeSettings({ ...typeSettings, maxMessageLength: Number(event.target.value) })} /></label><label className="moderation-filter-toggle"><input type="checkbox" checked={typeSettings.attachmentsEnabled} onChange={(event) => setTypeSettings({ ...typeSettings, attachmentsEnabled: event.target.checked })} /><span>Allow attachments</span></label><label className="moderation-filter-toggle"><input type="checkbox" checked={typeSettings.reactionsEnabled} onChange={(event) => setTypeSettings({ ...typeSettings, reactionsEnabled: event.target.checked })} /><span>Allow reactions</span></label></> : typeSettings.kind === "radio" ? <><div className="community-settings-grid"><label><span>Default host role</span><select value={typeSettings.defaultHostRole} onChange={(event) => setTypeSettings({ ...typeSettings, defaultHostRole: event.target.value as "owner" | "host" })}><option value="host">Host</option><option value="owner">Owner</option></select></label><label><span>Schedule visibility</span><select value={typeSettings.scheduleVisibility} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleVisibility: event.target.value as "public" | "members" })}><option value="public">Public</option><option value="members">Members</option></select></label></div><label><span>Schedule timezone</span><input maxLength={64} value={typeSettings.scheduleTimezone} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleTimezone: event.target.value })} /></label><label className="moderation-filter-toggle"><input type="checkbox" checked={typeSettings.listenerChatEnabled} onChange={(event) => setTypeSettings({ ...typeSettings, listenerChatEnabled: event.target.checked })} /><span>Enable listener chat when a listener channel is configured</span></label><label><span>Listener rules</span><textarea rows={3} maxLength={500} value={typeSettings.listenerRules} onChange={(event) => setTypeSettings({ ...typeSettings, listenerRules: event.target.value })} /></label></> : <><label><span>Default publisher role</span><select value={typeSettings.defaultPublisherRole} onChange={(event) => setTypeSettings({ ...typeSettings, defaultPublisherRole: event.target.value as "owner" | "publisher" })}><option value="publisher">Publisher</option><option value="owner">Owner</option></select></label><label className="moderation-filter-toggle"><input type="checkbox" checked={typeSettings.commentsEnabled} onChange={(event) => setTypeSettings({ ...typeSettings, commentsEnabled: event.target.checked })} /><span>Allow episode comments</span></label><label className="moderation-filter-toggle"><input type="checkbox" checked={typeSettings.explicitContentDefault} onChange={(event) => setTypeSettings({ ...typeSettings, explicitContentDefault: event.target.checked })} /><span>Mark new episodes explicit by default</span></label><label><span>Comment rules</span><textarea rows={3} maxLength={500} value={typeSettings.commentRules} onChange={(event) => setTypeSettings({ ...typeSettings, commentRules: event.target.value })} /></label></>}</section>
    {notice ? <p className="community-settings-notice" role="status">{notice}</p> : null}<button type="button" disabled={!access.permissions.includes("manageCommunity") || !name.trim() || saving || (rulesEnabled && !rules.length)} onClick={() => void save()}><AppIcon name="send" size="sm" />{saving ? "Validating and saving..." : "Save community settings"}</button>
  </div>;
}
