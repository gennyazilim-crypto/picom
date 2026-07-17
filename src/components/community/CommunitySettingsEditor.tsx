import { useEffect, useState, type ReactNode } from "react";
import type { Community } from "../../types/community";
import type { CommunityRule } from "../../types/communityRules";
import type { CommunityAccess, CommunityVisibility } from "../../types/communityAccess";
import { getDefaultCommunityTypeSettings, normalizeCommunityTypeSettings, type CommunityNotificationLevel, type CommunityTypeSettings } from "../../types/communitySettings";
import { communityBrandingService } from "../../services/communityBrandingService";
import { communityRulesService } from "../../services/communityRulesService";
import { communityService, type CommunitySummary } from "../../services/communityService";
import { AppIcon } from "../AppIcon";
import { isV1FeatureEnabled } from "../../config/v1ReleaseScope";
import "./CommunitySettingsEditor.css";

type Props = { community: Community; access: CommunityAccess; onUpdated: (community: CommunitySummary) => void };

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="community-settings-label">
      <strong>{children}</strong>
      {hint ? <small>{hint}</small> : null}
    </span>
  );
}

function ToggleRow({ checked, disabled, onChange, title, description }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; title: string; description?: string }) {
  return (
    <label className="community-settings-toggle">
      <span>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function CommunitySettingsEditor({ community, access, onUpdated }: Props) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [iconUrl, setIconUrl] = useState(/^https:|^data:image/i.test(community.icon) ? community.icon : "");
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? "");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [visibility] = useState<CommunityVisibility>(community.visibility ?? "private");
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

  useEffect(() => () => {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
  }, [bannerPreview, iconPreview]);

  const selectFile = (kind: "icon" | "banner", file: File | null) => {
    if (kind === "icon") {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      setIconFile(file);
      setIconPreview(file ? URL.createObjectURL(file) : null);
      return;
    }
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : null);
  };

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
    if (iconPreview) { URL.revokeObjectURL(iconPreview); setIconPreview(null); }
    if (bannerPreview) { URL.revokeObjectURL(bannerPreview); setBannerPreview(null); }
    onUpdated(result.data); setNotice("Community identity, rules, and type settings saved."); setSaving(false);
  };

  const resolvedBanner = bannerPreview ?? bannerUrl;
  const resolvedIcon = iconPreview ?? iconUrl;
  const typeLabel = community.kind === "text" ? "Text defaults" : community.kind === "radio" ? "Radio defaults" : "Podcast defaults";

  return (
    <div className="community-settings-editor">
      <section className="community-settings-card community-settings-branding" aria-label="Community branding">
        <div className="community-settings-brand-hero">
          <div className="community-settings-banner-preview">
            {resolvedBanner ? <img src={resolvedBanner} alt="Community banner preview" /> : (
              <div className="community-settings-banner-empty">
                <AppIcon name="image" size="xl" />
                <span>Banner preview</span>
              </div>
            )}
          </div>
          <div className="community-settings-icon-row">
            <div className="community-settings-icon-preview">
              {resolvedIcon ? <img src={resolvedIcon} alt="Community icon preview" /> : (
                <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>
              )}
            </div>
            <div className="community-settings-brand-copy">
              <strong>Branding assets</strong>
              <small>Icon and banner uploads are validated server-side. PNG, JPG, or WEBP only.</small>
            </div>
          </div>
        </div>
        <div className="community-settings-upload-grid">
          <div className="community-settings-upload-slot">
            <FieldLabel hint="PNG/JPG/WEBP, up to 2 MB">Icon</FieldLabel>
            <div className="community-settings-upload-toolbar">
              <label className="community-settings-action community-settings-action--ghost community-settings-file-trigger">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile("icon", event.target.files?.[0] ?? null)} />
                <AppIcon name="image" size="sm" />
                {iconFile ? iconFile.name : "Choose icon"}
              </label>
              {iconFile ? (
                <button type="button" className="community-settings-action community-settings-action--ghost" onClick={() => selectFile("icon", null)}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <div className="community-settings-upload-slot">
            <FieldLabel hint="PNG/JPG/WEBP, up to 6 MB">Banner</FieldLabel>
            <div className="community-settings-upload-toolbar">
              <label className="community-settings-action community-settings-action--ghost community-settings-file-trigger">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile("banner", event.target.files?.[0] ?? null)} />
                <AppIcon name="image" size="sm" />
                {bannerFile ? bannerFile.name : "Choose banner"}
              </label>
              {bannerFile ? (
                <button type="button" className="community-settings-action community-settings-action--ghost" onClick={() => selectFile("banner", null)}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="community-settings-card" aria-label="Community identity fields">
        <header className="community-settings-card-header">
          <strong>Identity</strong>
          <span>Name and description appear across discovery, invites, and member navigation.</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <label className="community-settings-field">
            <FieldLabel>Name</FieldLabel>
            <input className="community-settings-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="community-settings-field community-settings-field--full">
            <FieldLabel>Description</FieldLabel>
            <textarea className="community-settings-textarea" rows={4} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="community-settings-card" aria-label="Access and notifications">
        <header className="community-settings-card-header">
          <strong>Access and notifications</strong>
          <span>Visibility and default notification levels apply to new members.</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <label className="community-settings-field">
            <FieldLabel>Visibility</FieldLabel>
            <select className="community-settings-select" value={visibility} disabled>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="secret">Secret (managed secure lifecycle)</option>
            </select>
          </label>
          <label className="community-settings-field">
            <FieldLabel>Default notifications</FieldLabel>
            <select className="community-settings-select" value={defaultNotificationLevel} onChange={(event) => setDefaultNotificationLevel(event.target.value as CommunityNotificationLevel)}>
              <option value="all">All activity</option>
              <option value="mentions">Mentions</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <ToggleRow
          checked={visibility === "public" && publicReadEnabled}
          disabled={visibility !== "public"}
          onChange={setPublicReadEnabled}
          title="Allow visitors to read public content"
          description="Visitors can browse read-only content without joining."
        />
      </section>

      <section className="community-settings-card" aria-label="Rules and join acceptance">
        <header className="community-settings-card-header">
          <strong>Rules and join acceptance</strong>
          <span>Published text appears in the visitor join confirmation.</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <ToggleRow checked={rulesEnabled} onChange={setRulesEnabled} title="Require rules acceptance" description="New members must accept published rules before joining." />
          <label className="community-settings-field">
            <FieldLabel>Rules version</FieldLabel>
            <input className="community-settings-input" value={rulesVersion} maxLength={32} onChange={(event) => setRulesVersion(event.target.value)} />
          </label>
        </div>
        <div className="community-settings-rule-list">
          {rules.map((rule) => (
            <article className="community-settings-rule-card" key={rule.id}>
              <div className="community-settings-rule-fields">
                <input className="community-settings-input" value={rule.title} maxLength={120} aria-label="Rule title" placeholder="Rule title" onChange={(event) => updateRule(rule.id, { title: event.target.value })} />
                <textarea className="community-settings-textarea" rows={3} value={rule.body} maxLength={2000} aria-label="Rule text" placeholder="Describe expected community behavior." onChange={(event) => updateRule(rule.id, { body: event.target.value })} />
              </div>
              <div className="community-settings-rule-actions">
                <label className="community-settings-toggle community-settings-toggle--compact">
                  <span><strong>Required</strong></span>
                  <input type="checkbox" checked={rule.required} onChange={(event) => updateRule(rule.id, { required: event.target.checked })} />
                </label>
                <button type="button" className="community-settings-action community-settings-action--ghost community-settings-action--danger" aria-label="Remove rule" disabled={rules.length <= 1} onClick={() => setRules((items) => items.filter((item) => item.id !== rule.id))}>
                  <AppIcon name="trash" size="sm" />
                </button>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="community-settings-action community-settings-action--ghost" disabled={rules.length >= 10} onClick={() => setRules((items) => [...items, { id: `draft-${crypto.randomUUID()}`, communityId: community.id, title: "New rule", body: "Describe the expected community behavior.", required: true, position: items.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])}>
          <AppIcon name="plus" size="sm" />
          Add rule
        </button>
      </section>

      <section className="community-settings-card" aria-label="Community type defaults">
        <header className="community-settings-card-header">
          <strong>{typeLabel}</strong>
          <span>These settings are enforced by the matching service and RLS paths.</span>
        </header>
        <div className="community-settings-stack">
          {isV1FeatureEnabled("voiceRooms") ? <ToggleRow checked={typeSettings.voiceRoomsEnabled} onChange={(checked) => setTypeSettings({ ...typeSettings, voiceRoomsEnabled: checked })} title="Enable normal voice rooms for this community type" /> : null}
          {typeSettings.kind === "text" ? (
            <>
              <label className="community-settings-field">
                <FieldLabel>Maximum message length</FieldLabel>
                <input className="community-settings-input" type="number" min={250} max={4000} value={typeSettings.maxMessageLength} onChange={(event) => setTypeSettings({ ...typeSettings, maxMessageLength: Number(event.target.value) })} />
              </label>
              <ToggleRow checked={typeSettings.attachmentsEnabled} onChange={(checked) => setTypeSettings({ ...typeSettings, attachmentsEnabled: checked })} title="Allow attachments" />
              <ToggleRow checked={typeSettings.reactionsEnabled} onChange={(checked) => setTypeSettings({ ...typeSettings, reactionsEnabled: checked })} title="Allow reactions" />
            </>
          ) : typeSettings.kind === "radio" ? (
            <>
              <div className="community-settings-fields community-settings-fields--split">
                <label className="community-settings-field">
                  <FieldLabel>Default host role</FieldLabel>
                  <select className="community-settings-select" value={typeSettings.defaultHostRole} onChange={(event) => setTypeSettings({ ...typeSettings, defaultHostRole: event.target.value as "owner" | "host" })}>
                    <option value="host">Host</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <label className="community-settings-field">
                  <FieldLabel>Schedule visibility</FieldLabel>
                  <select className="community-settings-select" value={typeSettings.scheduleVisibility} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleVisibility: event.target.value as "public" | "members" })}>
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                  </select>
                </label>
              </div>
              <label className="community-settings-field">
                <FieldLabel>Schedule timezone</FieldLabel>
                <input className="community-settings-input" maxLength={64} value={typeSettings.scheduleTimezone} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleTimezone: event.target.value })} />
              </label>
              <ToggleRow checked={typeSettings.listenerChatEnabled} onChange={(checked) => setTypeSettings({ ...typeSettings, listenerChatEnabled: checked })} title="Enable listener chat when a listener channel is configured" />
              <label className="community-settings-field">
                <FieldLabel>Listener rules</FieldLabel>
                <textarea className="community-settings-textarea" rows={3} maxLength={500} value={typeSettings.listenerRules} onChange={(event) => setTypeSettings({ ...typeSettings, listenerRules: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className="community-settings-field">
                <FieldLabel>Default publisher role</FieldLabel>
                <select className="community-settings-select" value={typeSettings.defaultPublisherRole} onChange={(event) => setTypeSettings({ ...typeSettings, defaultPublisherRole: event.target.value as "owner" | "publisher" })}>
                  <option value="publisher">Publisher</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <ToggleRow checked={typeSettings.commentsEnabled} onChange={(checked) => setTypeSettings({ ...typeSettings, commentsEnabled: checked })} title="Allow episode comments" />
              <ToggleRow checked={typeSettings.explicitContentDefault} onChange={(checked) => setTypeSettings({ ...typeSettings, explicitContentDefault: checked })} title="Mark new episodes explicit by default" />
              <label className="community-settings-field">
                <FieldLabel>Comment rules</FieldLabel>
                <textarea className="community-settings-textarea" rows={3} maxLength={500} value={typeSettings.commentRules} onChange={(event) => setTypeSettings({ ...typeSettings, commentRules: event.target.value })} />
              </label>
            </>
          )}
        </div>
      </section>

      <footer className="community-settings-footer">
        {notice ? <p className={`community-settings-notice${notice.includes("saved") ? " is-success" : ""}`} role="status">{notice}</p> : null}
        <button type="button" className="community-settings-action" disabled={!access.permissions.includes("manageCommunity") || !name.trim() || saving || (rulesEnabled && !rules.length)} onClick={() => void save()}>
          <AppIcon name="send" size="sm" />
          {saving ? "Validating and saving..." : "Save community settings"}
        </button>
      </footer>
    </div>
  );
}
