import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import type { Community } from "../../types/community";
import type { CommunityRule } from "../../types/communityRules";
import type { CommunityAccess, CommunityVisibility } from "../../types/communityAccess";
import { getDefaultCommunityTypeSettings, normalizeCommunityTypeSettings, type CommunityNotificationLevel, type CommunityTypeSettings } from "../../types/communitySettings";
import { communityBrandingService } from "../../services/communityBrandingService";
import { communityRulesService } from "../../services/communityRulesService";
import { communityService, type CommunitySummary } from "../../services/communityService";
import { communityDiscoveryService, type DiscoveryCategory, type DiscoveryJoinPolicy } from "../../services/communityDiscoveryService";
import { isV1FeatureEnabled } from "../../config/v1ReleaseScope";
import { AppIcon } from "../AppIcon";
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
    <label className={`community-settings-toggle${disabled ? " is-disabled" : ""}`}>
      <span>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function shortFileName(name: string, max = 28) {
  if (name.length <= max) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, Math.max(8, max - ext.length - 1));
  return `${base}…${ext}`;
}

function readInitialIconUrl(community: Community) {
  return /^https?:|^data:image/i.test(community.icon ?? "") ? community.icon : "";
}

export function CommunitySettingsEditor({ community, access, onUpdated }: Props) {
  const { t } = useTranslation("common");
  const canManage = access.permissions.includes("manageCommunity");
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [iconUrl, setIconUrl] = useState(() => readInitialIconUrl(community));
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? "");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<CommunityVisibility>(community.visibility === "secret" ? "secret" : "public");
  const [publicReadEnabled, setPublicReadEnabled] = useState(community.publicReadEnabled ?? false);
  const [defaultNotificationLevel, setDefaultNotificationLevel] = useState<CommunityNotificationLevel>(community.defaultNotificationLevel ?? "mentions");
  const [rulesEnabled, setRulesEnabled] = useState(community.rulesEnabled ?? false);
  const [rulesVersion, setRulesVersion] = useState(community.rulesVersion ?? "1");
  const [discoveryListed, setDiscoveryListed] = useState(community.discoveryListed ?? false);
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory>(community.discoveryCategory ?? "work");
  const [discoveryJoinPolicy, setDiscoveryJoinPolicy] = useState<DiscoveryJoinPolicy>(community.discoveryJoinPolicy ?? "open");
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [typeSettings, setTypeSettings] = useState<CommunityTypeSettings>(() => normalizeCommunityTypeSettings(community.kind, community.typeSettings ?? getDefaultCommunityTypeSettings(community.kind)));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsSuccess, setNoticeIsSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setName(community.name);
    setDescription(community.description ?? "");
    setIconUrl(readInitialIconUrl(community));
    setBannerUrl(community.bannerUrl ?? "");
    setVisibility(community.visibility === "secret" ? "secret" : "public");
    setPublicReadEnabled(community.publicReadEnabled ?? false);
    setDefaultNotificationLevel(community.defaultNotificationLevel ?? "mentions");
    setRulesEnabled(community.rulesEnabled ?? false);
    setRulesVersion(community.rulesVersion ?? "1");
    setDiscoveryListed(community.discoveryListed ?? false);
    setDiscoveryCategory(community.discoveryCategory ?? "work");
    setDiscoveryJoinPolicy(community.discoveryJoinPolicy ?? "open");
    setTypeSettings(normalizeCommunityTypeSettings(community.kind, community.typeSettings ?? getDefaultCommunityTypeSettings(community.kind)));
    setIconFile(null);
    setBannerFile(null);
    setUploadError(null);
    setNotice(null);
    setNoticeIsSuccess(false);
    if (iconInputRef.current) iconInputRef.current.value = "";
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }, [community.id, community.name, community.description, community.icon, community.bannerUrl, community.visibility, community.publicReadEnabled, community.defaultNotificationLevel, community.rulesEnabled, community.rulesVersion, community.discoveryListed, community.discoveryCategory, community.discoveryJoinPolicy, community.kind, community.typeSettings]);

  useEffect(() => {
    let active = true;
    void communityRulesService.loadPublishedRules(community.id).then((result) => {
      if (active) setRules(result.ok ? result.rules : communityRulesService.getDefaultRules(community.id));
    });
    return () => {
      active = false;
    };
  }, [community.id]);

  useEffect(
    () => () => {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    },
    [bannerPreview, iconPreview],
  );

  const selectFile = (kind: "icon" | "banner", file: File | null) => {
    setUploadError(null);
    const clearInput = () => {
      const ref = kind === "icon" ? iconInputRef : bannerInputRef;
      if (ref.current) ref.current.value = "";
    };

    if (kind === "icon") {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      if (!file) {
        setIconFile(null);
        setIconPreview(null);
        clearInput();
        return;
      }
      const validation = communityBrandingService.validate(file, "icon");
      if (!validation.ok) {
        setIconFile(null);
        setIconPreview(null);
        setUploadError(validation.message);
        clearInput();
        return;
      }
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
      return;
    }

    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    if (!file) {
      setBannerFile(null);
      setBannerPreview(null);
      clearInput();
      return;
    }
    const validation = communityBrandingService.validate(file, "banner");
    if (!validation.ok) {
      setBannerFile(null);
      setBannerPreview(null);
      setUploadError(validation.message);
      clearInput();
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearStoredAsset = (kind: "icon" | "banner") => {
    if (kind === "icon") {
      selectFile("icon", null);
      setIconUrl("");
      return;
    }
    selectFile("banner", null);
    setBannerUrl("");
  };

  const updateRule = (id: string, change: Partial<Pick<CommunityRule, "title" | "body" | "required">>) =>
    setRules((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const dirty = useMemo(() => {
    const initialIcon = readInitialIconUrl(community);
    const initialBanner = community.bannerUrl ?? "";
    const initialVisibility = community.visibility === "secret" ? "secret" : "public";
    return (
      name.trim() !== community.name ||
      (description.trim() || "") !== (community.description ?? "") ||
      iconUrl !== initialIcon ||
      bannerUrl !== initialBanner ||
      Boolean(iconFile) ||
      Boolean(bannerFile) ||
      visibility !== initialVisibility ||
      publicReadEnabled !== (community.publicReadEnabled ?? false) ||
      defaultNotificationLevel !== (community.defaultNotificationLevel ?? "mentions") ||
      rulesEnabled !== (community.rulesEnabled ?? false) ||
      rulesVersion !== (community.rulesVersion ?? "1") ||
      discoveryListed !== (community.discoveryListed ?? false) ||
      discoveryCategory !== (community.discoveryCategory ?? "work") ||
      discoveryJoinPolicy !== (community.discoveryJoinPolicy ?? "open") ||
      JSON.stringify(typeSettings) !== JSON.stringify(normalizeCommunityTypeSettings(community.kind, community.typeSettings ?? getDefaultCommunityTypeSettings(community.kind)))
    );
  }, [bannerFile, bannerUrl, community, defaultNotificationLevel, description, discoveryCategory, discoveryJoinPolicy, discoveryListed, iconFile, iconUrl, name, publicReadEnabled, rulesEnabled, rulesVersion, typeSettings, visibility]);

  const save = async () => {
    if (!canManage) return;
    const cleanedName = name.trim().replace(/\s+/g, " ");
    if (!cleanedName) {
      setNoticeIsSuccess(false);
      setNotice(t("communitySettings.nameRequired"));
      return;
    }
    if (rulesEnabled && !rules.length) {
      setNoticeIsSuccess(false);
      setNotice(t("communitySettings.ruleRequired"));
      return;
    }

    setSaving(true);
    setNotice(null);
    setNoticeIsSuccess(false);
    setUploadError(null);
    const uploadedPaths: string[] = [];
    let nextIconUrl = iconUrl;
    let nextBannerUrl = bannerUrl;

    for (const [kind, file] of [
      ["icon", iconFile],
      ["banner", bannerFile],
    ] as const) {
      if (!file) continue;
      const uploaded = await communityBrandingService.upload(community.id, kind, file);
      if (!uploaded.ok) {
        setNoticeIsSuccess(false);
        setNotice(uploaded.message);
        setSaving(false);
        return;
      }
      if (uploaded.data.storagePath) uploadedPaths.push(uploaded.data.storagePath);
      if (kind === "icon") nextIconUrl = uploaded.data.url;
      else nextBannerUrl = uploaded.data.url;
    }

    const result = await communityService.updateCommunitySettings({
      id: community.id,
      name: cleanedName,
      description: description.trim(),
      iconUrl: nextIconUrl || null,
      bannerUrl: nextBannerUrl || null,
      visibility,
      publicReadEnabled: visibility === "public" && publicReadEnabled,
      defaultNotificationLevel,
      rulesEnabled,
      rulesVersion,
      typeSettings,
      rules,
    });

    if (!result.ok) {
      await Promise.all(uploadedPaths.map((path) => communityBrandingService.remove(path)));
      setNoticeIsSuccess(false);
      setNotice(result.error.message);
      setSaving(false);
      return;
    }

    const discoveryChanged =
      discoveryListed !== (community.discoveryListed ?? false) ||
      discoveryCategory !== (community.discoveryCategory ?? "work") ||
      discoveryJoinPolicy !== (community.discoveryJoinPolicy ?? "open");
    if (discoveryChanged) {
      const discoveryResult = await communityDiscoveryService.setDiscoveryListing(community.id, discoveryListed, {
        category: discoveryCategory,
        joinPolicy: discoveryJoinPolicy,
      });
      if (!discoveryResult.ok) {
        onUpdated(result.data);
        setNoticeIsSuccess(false);
        setNotice(t("communitySettings.savePartial", { message: discoveryResult.message }));
        setSaving(false);
        return;
      }
    }

    setName(result.data.name);
    setDescription(result.data.description ?? "");
    setIconUrl(result.data.iconUrl ?? "");
    setBannerUrl(result.data.bannerUrl ?? "");
    setVisibility(result.data.visibility === "secret" ? "secret" : "public");
    setPublicReadEnabled(result.data.publicReadEnabled);
    setDefaultNotificationLevel(result.data.defaultNotificationLevel);
    setRulesEnabled(result.data.rulesEnabled);
    setRulesVersion(result.data.rulesVersion);
    setTypeSettings(result.data.typeSettings);
    setIconFile(null);
    setBannerFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
    }
    if (iconInputRef.current) iconInputRef.current.value = "";
    if (bannerInputRef.current) bannerInputRef.current.value = "";
    onUpdated({
      ...result.data,
      discoveryListed,
      discoveryCategory,
      discoveryJoinPolicy,
    });
    setNoticeIsSuccess(true);
    setNotice(
      discoveryChanged && discoveryListed
        ? t("communitySettings.savedListed")
        : discoveryChanged
          ? t("communitySettings.savedUnlisted")
          : t("communitySettings.saved"),
    );
    setSaving(false);
  };

  const resolvedBanner = bannerPreview ?? bannerUrl;
  const resolvedIcon = iconPreview ?? iconUrl;
  const typeLabel = community.kind === "text" ? t("communitySettings.textDefaults") : community.kind === "radio" ? t("communitySettings.radioDefaults") : t("communitySettings.podcastDefaults");
  const nameLength = name.trim().length;
  const descriptionLength = description.length;

  return (
    <div className="community-settings-editor">
      <section className="community-settings-card community-settings-branding" aria-label={t("communitySettings.branding")}>
        <div className="community-settings-brand-hero">
          <div className="community-settings-banner-preview">
            {resolvedBanner ? (
              <img src={resolvedBanner} alt={t("communitySettings.bannerPreview")} />
            ) : (
              <div className="community-settings-banner-empty">
                <AppIcon name="image" size="xl" />
                <span>{t("communitySettings.bannerPreview")}</span>
              </div>
            )}
          </div>
          <div className="community-settings-icon-row">
            <div className="community-settings-icon-preview">
              {resolvedIcon ? <img src={resolvedIcon} alt={t("communitySettings.iconPreview")} /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>}
            </div>
            <div className="community-settings-brand-copy">
              <strong>{t("communitySettings.brandingAssets")}</strong>
              <small>{t("communitySettings.brandingHint")}</small>
            </div>
          </div>
        </div>

        <div className="community-settings-upload-grid">
          <div className="community-settings-upload-slot">
            <FieldLabel hint={t("communitySettings.iconHint")}>{t("communitySettings.icon")}</FieldLabel>
            <div className="community-settings-upload-toolbar">
              <label className={`community-settings-action community-settings-action--ghost community-settings-file-trigger${!canManage ? " is-disabled" : ""}`}>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={!canManage || saving}
                  onChange={(event) => selectFile("icon", event.target.files?.[0] ?? null)}
                />
                <AppIcon name="image" size="sm" />
                {iconFile || iconUrl ? t("communitySettings.replaceIcon") : t("communitySettings.chooseIcon")}
              </label>
              {iconFile || iconUrl ? (
                <button type="button" className="community-settings-action community-settings-action--ghost" disabled={!canManage || saving} onClick={() => clearStoredAsset("icon")}>
                  {t("action.remove")}
                </button>
              ) : null}
            </div>
            {iconFile ? <span className="community-settings-file-meta">{shortFileName(iconFile.name)}</span> : null}
          </div>

          <div className="community-settings-upload-slot">
            <FieldLabel hint={t("communitySettings.bannerHint")}>{t("communitySettings.banner")}</FieldLabel>
            <div className="community-settings-upload-toolbar">
              <label className={`community-settings-action community-settings-action--ghost community-settings-file-trigger${!canManage ? " is-disabled" : ""}`}>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={!canManage || saving}
                  onChange={(event) => selectFile("banner", event.target.files?.[0] ?? null)}
                />
                <AppIcon name="image" size="sm" />
                {bannerFile || bannerUrl ? t("communitySettings.replaceBanner") : t("communitySettings.chooseBanner")}
              </label>
              {bannerFile || bannerUrl ? (
                <button type="button" className="community-settings-action community-settings-action--ghost" disabled={!canManage || saving} onClick={() => clearStoredAsset("banner")}>
                  {t("action.remove")}
                </button>
              ) : null}
            </div>
            {bannerFile ? <span className="community-settings-file-meta">{shortFileName(bannerFile.name)}</span> : null}
          </div>
        </div>
        {uploadError ? (
          <p className="community-settings-inline-error" role="alert">
            {uploadError}
          </p>
        ) : null}
      </section>

      <section className="community-settings-card" aria-label={t("communitySettings.identity")}>
        <header className="community-settings-card-header">
          <strong>{t("communitySettings.identity")}</strong>
          <span>{t("communitySettings.identityDescription")}</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <label className="community-settings-field">
            <span className="community-settings-label-row">
              <FieldLabel>{t("communitySettings.name")}</FieldLabel>
              <span className={`community-settings-count${nameLength === 0 ? " is-empty" : ""}`}>{nameLength}/80</span>
            </span>
            <input className="community-settings-input" value={name} maxLength={80} disabled={!canManage || saving} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="community-settings-field community-settings-field--full">
            <span className="community-settings-label-row">
              <FieldLabel>{t("communitySettings.description")}</FieldLabel>
              <span className="community-settings-count">{descriptionLength}/500</span>
            </span>
            <textarea className="community-settings-textarea" rows={4} maxLength={500} value={description} disabled={!canManage || saving} onChange={(event) => setDescription(event.target.value)} placeholder={t("communitySettings.descriptionPlaceholder")} />
          </label>
        </div>
      </section>

      <section className="community-settings-card" aria-label={t("communitySettings.access")}>
        <header className="community-settings-card-header">
          <strong>{t("communitySettings.access")}</strong>
          <span>{t("communitySettings.accessDescription")}</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <label className="community-settings-field">
            <FieldLabel>{t("communitySettings.visibility")}</FieldLabel>
            <select
              className="community-settings-select"
              value={visibility}
              disabled={!canManage || saving}
              onChange={(event) => {
                const next = event.target.value as CommunityVisibility;
                setVisibility(next === "secret" ? "secret" : "public");
                if (next !== "public") {
                  setPublicReadEnabled(false);
                  setDiscoveryListed(false);
                }
              }}
            >
              <option value="public">{t("communitySettings.public")}</option>
              <option value="secret">{t("communitySettings.secret")}</option>
            </select>
          </label>
          <label className="community-settings-field">
            <FieldLabel>{t("communitySettings.defaultNotifications")}</FieldLabel>
            <select className="community-settings-select" value={defaultNotificationLevel} disabled={!canManage || saving} onChange={(event) => setDefaultNotificationLevel(event.target.value as CommunityNotificationLevel)}>
              <option value="all">{t("communitySettings.allActivity")}</option>
              <option value="mentions">{t("communitySettings.mentions")}</option>
              <option value="none">{t("communitySettings.none")}</option>
            </select>
          </label>
        </div>
        <ToggleRow
          checked={visibility === "public" && publicReadEnabled}
          disabled={!canManage || saving || visibility !== "public"}
          onChange={setPublicReadEnabled}
          title={t("communitySettings.allowPublicRead")}
          description={t("communitySettings.allowPublicReadDescription")}
        />
      </section>

      {isV1FeatureEnabled("discoveryMarketplace") ? (
        <section className="community-settings-card" aria-label={t("communitySettings.discoveryListing")}>
          <header className="community-settings-card-header">
            <strong>{t("communitySettings.discoveryListing")}</strong>
            <span>{t("communitySettings.discoveryDescription")}</span>
          </header>
          <ToggleRow
            checked={discoveryListed}
            disabled={!canManage || saving || visibility !== "public"}
            onChange={(checked) => {
              setDiscoveryListed(checked);
              if (checked) setPublicReadEnabled(true);
            }}
            title={t("communitySettings.submitDiscovery")}
            description={discoveryListed ? t("communitySettings.discoveryOnDescription") : t("communitySettings.discoveryOffDescription")}
          />
          <div className="community-settings-fields community-settings-fields--split">
            <label className="community-settings-field">
              <FieldLabel>{t("communitySettings.category")}</FieldLabel>
              <select className="community-settings-select" value={discoveryCategory} disabled={!canManage || saving || !discoveryListed} onChange={(event) => setDiscoveryCategory(event.target.value as DiscoveryCategory)}>
                <option value="development">{t("communitySettings.categoryDevelopment")}</option>
                <option value="design">{t("communitySettings.categoryDesign")}</option>
                <option value="gaming">{t("communitySettings.categoryGaming")}</option>
                <option value="music">{t("communitySettings.categoryMusic")}</option>
                <option value="study">{t("communitySettings.categoryStudy")}</option>
                <option value="work">{t("communitySettings.categoryWork")}</option>
              </select>
            </label>
            <label className="community-settings-field">
              <FieldLabel>{t("communitySettings.joinPolicy")}</FieldLabel>
              <select className="community-settings-select" value={discoveryJoinPolicy} disabled={!canManage || saving || !discoveryListed} onChange={(event) => setDiscoveryJoinPolicy(event.target.value as DiscoveryJoinPolicy)}>
                <option value="open">{t("communitySettings.openJoin")}</option>
                <option value="request">{t("communitySettings.requestApproval")}</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <section className="community-settings-card" aria-label={t("communitySettings.rules")}>
        <header className="community-settings-card-header">
          <strong>{t("communitySettings.rules")}</strong>
          <span>{t("communitySettings.rulesDescription")}</span>
        </header>
        <div className="community-settings-fields community-settings-fields--split">
          <ToggleRow checked={rulesEnabled} disabled={!canManage || saving} onChange={setRulesEnabled} title={t("communitySettings.requireRules")} description={t("communitySettings.requireRulesDescription")} />
          <label className="community-settings-field">
            <FieldLabel>{t("communitySettings.rulesVersion")}</FieldLabel>
            <input className="community-settings-input" value={rulesVersion} maxLength={32} disabled={!canManage || saving} onChange={(event) => setRulesVersion(event.target.value)} />
          </label>
        </div>
        <div className="community-settings-rule-list">
          {rules.map((rule) => (
            <article className="community-settings-rule-card" key={rule.id}>
              <div className="community-settings-rule-fields">
                <input className="community-settings-input" value={rule.title} maxLength={120} aria-label={t("communitySettings.ruleTitle")} placeholder={t("communitySettings.ruleTitle")} disabled={!canManage || saving} onChange={(event) => updateRule(rule.id, { title: event.target.value })} />
                <textarea className="community-settings-textarea" rows={3} value={rule.body} maxLength={2000} aria-label={t("communitySettings.ruleText")} placeholder={t("communitySettings.ruleTextPlaceholder")} disabled={!canManage || saving} onChange={(event) => updateRule(rule.id, { body: event.target.value })} />
              </div>
              <div className="community-settings-rule-actions">
                <label className="community-settings-toggle community-settings-toggle--compact">
                  <span>
                    <strong>{t("communitySettings.required")}</strong>
                  </span>
                  <input type="checkbox" checked={rule.required} disabled={!canManage || saving} onChange={(event) => updateRule(rule.id, { required: event.target.checked })} />
                </label>
                <button type="button" className="community-settings-action community-settings-action--ghost community-settings-action--danger" aria-label={t("communitySettings.removeRule")} disabled={!canManage || saving || rules.length <= 1} onClick={() => setRules((items) => items.filter((item) => item.id !== rule.id))}>
                  <AppIcon name="trash" size="sm" />
                </button>
              </div>
            </article>
          ))}
        </div>
        <button
          type="button"
          className="community-settings-action community-settings-action--ghost"
          disabled={!canManage || saving || rules.length >= 10}
          onClick={() =>
            setRules((items) => [
              ...items,
              {
                id: `draft-${crypto.randomUUID()}`,
                communityId: community.id,
                title: t("communitySettings.newRule"),
                body: t("communitySettings.ruleTextPlaceholder"),
                required: true,
                position: items.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ])
          }
        >
          <AppIcon name="plus" size="sm" />
          {t("communitySettings.addRule")}
        </button>
      </section>

      <section className="community-settings-card" aria-label={t("communitySettings.typeDefaults")}>
        <header className="community-settings-card-header">
          <strong>{typeLabel}</strong>
          <span>{t("communitySettings.defaultsDescription")}</span>
        </header>
        <div className="community-settings-stack">
          {isV1FeatureEnabled("voiceRooms") ? <ToggleRow checked={typeSettings.voiceRoomsEnabled} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, voiceRoomsEnabled: checked })} title={t("communitySettings.normalVoice")} /> : null}
          {typeSettings.kind === "text" ? (
            <>
              <label className="community-settings-field">
                <FieldLabel>{t("communitySettings.maxMessageLength")}</FieldLabel>
                <input className="community-settings-input" type="number" min={250} max={4000} value={typeSettings.maxMessageLength} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, maxMessageLength: Number(event.target.value) })} />
              </label>
              <ToggleRow checked={typeSettings.attachmentsEnabled} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, attachmentsEnabled: checked })} title={t("communitySettings.allowAttachments")} />
              <ToggleRow checked={typeSettings.reactionsEnabled} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, reactionsEnabled: checked })} title={t("communitySettings.allowReactions")} />
            </>
          ) : typeSettings.kind === "radio" ? (
            <>
              <div className="community-settings-fields community-settings-fields--split">
                <label className="community-settings-field">
                  <FieldLabel>Default host role</FieldLabel>
                  <select className="community-settings-select" value={typeSettings.defaultHostRole} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, defaultHostRole: event.target.value as "owner" | "host" })}>
                    <option value="host">Host</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <label className="community-settings-field">
                  <FieldLabel>Schedule visibility</FieldLabel>
                  <select className="community-settings-select" value={typeSettings.scheduleVisibility} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleVisibility: event.target.value as "public" | "members" })}>
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                  </select>
                </label>
              </div>
              <label className="community-settings-field">
                <FieldLabel>Schedule timezone</FieldLabel>
                <input className="community-settings-input" maxLength={64} value={typeSettings.scheduleTimezone} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, scheduleTimezone: event.target.value })} />
              </label>
              <ToggleRow checked={typeSettings.listenerChatEnabled} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, listenerChatEnabled: checked })} title="Enable listener chat when a listener channel is configured" />
              <label className="community-settings-field">
                <FieldLabel>Listener rules</FieldLabel>
                <textarea className="community-settings-textarea" rows={3} maxLength={500} value={typeSettings.listenerRules} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, listenerRules: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className="community-settings-field">
                <FieldLabel>Default publisher role</FieldLabel>
                <select className="community-settings-select" value={typeSettings.defaultPublisherRole} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, defaultPublisherRole: event.target.value as "owner" | "publisher" })}>
                  <option value="publisher">Publisher</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <ToggleRow checked={typeSettings.commentsEnabled} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, commentsEnabled: checked })} title="Allow episode comments" />
              <ToggleRow checked={typeSettings.explicitContentDefault} disabled={!canManage || saving} onChange={(checked) => setTypeSettings({ ...typeSettings, explicitContentDefault: checked })} title="Mark new episodes explicit by default" />
              <label className="community-settings-field">
                <FieldLabel>Comment rules</FieldLabel>
                <textarea className="community-settings-textarea" rows={3} maxLength={500} value={typeSettings.commentRules} disabled={!canManage || saving} onChange={(event) => setTypeSettings({ ...typeSettings, commentRules: event.target.value })} />
              </label>
            </>
          )}
        </div>
      </section>

      <footer className="community-settings-footer">
        {notice ? (
          <p className={`community-settings-notice${noticeIsSuccess ? " is-success" : " is-error"}`} role="status">
            {notice}
          </p>
        ) : dirty ? (
          <p className="community-settings-notice" role="status">
            {t("communitySettings.unsaved")}
          </p>
        ) : (
          <p className="community-settings-notice" role="status">
            {canManage ? t("communitySettings.upToDate") : t("communitySettings.noPermission")}
          </p>
        )}
        <button type="button" className="community-settings-action" disabled={!canManage || !name.trim() || saving || (rulesEnabled && !rules.length)} onClick={() => void save()}>
          <AppIcon name="send" size="sm" />
          {saving ? t("status.saving") : t("communitySettings.save")}
        </button>
      </footer>
    </div>
  );
}
