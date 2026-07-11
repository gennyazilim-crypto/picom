import { useMemo, useState } from "react";
import { communityTemplates } from "../data/communityTemplates";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import type { CommunityKind } from "../types/community";
import type { CommunityTemplateId } from "../types/communityTemplates";
import { AppIcon, type IconName } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import "./CreateCommunityModal.css";

const overlayIcons = mvpUiIconMap.overlays;

export type CreateCommunityFormValue = Readonly<{
  kind: CommunityKind;
  name: string;
  description?: string;
  iconUrl?: string;
  visibility: "public" | "private";
  publicReadEnabled: boolean;
  templateId?: CommunityTemplateId;
}>;

export type CreateCommunitySubmitResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: string }>;

type CreateCommunityModalProps = {
  onClose: () => void;
  onSubmit: (value: CreateCommunityFormValue) => Promise<CreateCommunitySubmitResult>;
};

type KindOption = Readonly<{
  kind: CommunityKind;
  title: string;
  description: string;
  capabilities: readonly string[];
  limitation: string;
  icon: IconName;
}>;

const KIND_OPTIONS: readonly KindOption[] = [
  { kind: "text", title: "Text Community", description: "A structured space for channels, messages, files, roles, and voice rooms.", capabilities: ["Text and voice channels", "Replies, reactions, and attachments", "Private channel permissions"], limitation: "Does not publish live radio or podcast episodes.", icon: "hash" },
  { kind: "radio", title: "Radio Community", description: "A live-first station for scheduled broadcasts, hosts, and listener sessions.", capabilities: ["Live and scheduled radio", "Host and listener presence", "Broadcast-focused community shell"], limitation: "Does not use the normal text-channel tree.", icon: "microphone" },
  { kind: "podcast", title: "Podcast Community", description: "An on-demand publishing space for shows, episodes, creators, and listeners.", capabilities: ["Episode publishing", "Series and creator context", "On-demand playback shell"], limitation: "Does not use the normal text-channel tree.", icon: "headphones" },
] as const;

const STEPS = ["Community type", "Identity", "Access and setup"] as const;

function isHttpsUrl(value: string): boolean {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function CreateCommunityModal({ onClose, onSubmit }: CreateCommunityModalProps) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<CommunityKind | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [publicReadEnabled, setPublicReadEnabled] = useState(true);
  const [templateId, setTemplateId] = useState<CommunityTemplateId>("custom");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedTemplate = communityTemplates.find((template) => template.id === templateId) ?? communityTemplates[0];
  const selectedKind = KIND_OPTIONS.find((option) => option.kind === kind) ?? null;
  const dialogRef = useDialogFocusTrap<HTMLElement>(saving ? () => undefined : onClose);
  const textTemplateChannels = useMemo(() => selectedTemplate.categories.flatMap((category) => category.channels), [selectedTemplate]);

  const validateIdentity = (): string | null => {
    const cleanedName = name.trim().replace(/\s+/g, " ");
    if (!cleanedName) return "Community name is required.";
    if (cleanedName.length > 80) return "Community name must be 80 characters or fewer.";
    if (description.trim().length > 500) return "Description must be 500 characters or fewer.";
    if (iconUrl.trim().length > 2048 || !isHttpsUrl(iconUrl.trim())) return "Community icon must be a valid HTTPS URL.";
    return null;
  };

  const goNext = () => {
    setError(null);
    if (step === 0 && !kind) { setError("Choose Text, Radio, or Podcast before continuing."); return; }
    if (step === 1) {
      const identityError = validateIdentity();
      if (identityError) { setError(identityError); return; }
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const submit = async () => {
    if (!kind) { setStep(0); setError("Choose a community type before creating it."); return; }
    const identityError = validateIdentity();
    if (identityError) { setStep(1); setError(identityError); return; }
    if (visibility !== "public" && visibility !== "private") { setError("Choose a valid community visibility."); return; }

    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        kind,
        name: name.trim().replace(/\s+/g, " "),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        visibility,
        publicReadEnabled: visibility === "public" && publicReadEnabled,
        templateId: kind === "text" ? templateId : "custom",
      });
      if (!result.ok) setError(result.error);
    } catch {
      setError("Could not create community. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectKind = (nextKind: CommunityKind) => { setKind(nextKind); setTemplateId("custom"); setError(null); };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!saving) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="create-community-modal typed-community-wizard" aria-modal="true" role="dialog" aria-labelledby="create-community-title" aria-describedby="create-community-description" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button modal-close" aria-label="Close create community" onClick={onClose} disabled={saving}><AppIcon name={overlayIcons.close} size="lg" /></button>
        <header className="typed-community-wizard__header"><div><span className="eyebrow">New community</span><h2 id="create-community-title">Create a Picom community</h2><p id="create-community-description">Choose the product space first. Picom keeps Text, Radio, and Podcast communities intentionally separate.</p></div><span className="typed-community-wizard__step-count">Step {step + 1} of {STEPS.length}</span></header>
        <ol className="typed-community-wizard__progress" aria-label="Community creation progress">{STEPS.map((label, index) => <li key={label} className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} aria-current={index === step ? "step" : undefined}><span>{index < step ? "OK" : index + 1}</span><strong>{label}</strong></li>)}</ol>

        <div className="typed-community-wizard__body">
          {step === 0 ? <section className="typed-community-wizard__step" aria-labelledby="community-kind-heading"><div className="typed-community-wizard__intro"><span className="eyebrow">Required</span><h3 id="community-kind-heading">What are you creating?</h3><p>The selected type controls capabilities, navigation, and the shell opened after creation.</p></div><div className="community-kind-grid" role="radiogroup" aria-label="Community type">{KIND_OPTIONS.map((option, index) => <button key={option.kind} type="button" role="radio" aria-checked={kind === option.kind} className={`community-kind-card ${kind === option.kind ? "selected" : ""}`} onClick={() => selectKind(option.kind)} data-dialog-initial-focus={index === 0 ? true : undefined}><span className="community-kind-card__icon"><AppIcon name={option.icon} size="xl" /></span><span className="community-kind-card__copy"><strong>{option.title}</strong><small>{option.description}</small></span><ul>{option.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul><span className="community-kind-card__limit"><AppIcon name="lock" size="xs" />{option.limitation}</span></button>)}</div></section> : null}

          {step === 1 ? <section className="typed-community-wizard__step" aria-labelledby="community-identity-heading"><div className="typed-community-wizard__intro"><span className="eyebrow">{selectedKind?.title}</span><h3 id="community-identity-heading">Give the community an identity</h3><p>Name is required. Description and icon can be refined later in community settings.</p></div><div className="typed-community-wizard__fields"><label className="auth-field">Community name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus data-dialog-initial-focus placeholder={kind === "radio" ? "Northwave Radio" : kind === "podcast" ? "Orbit Podcast" : "Aurora Studio"} /></label><label className="auth-field typed-community-wizard__wide">Description <span className="optional-label">optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="What should members know about this community?" /></label><label className="auth-field typed-community-wizard__wide">Icon URL <span className="optional-label">optional HTTPS</span><div className="typed-community-wizard__icon-field"><span aria-hidden="true"><AppIcon name="image" size="md" /></span><input type="url" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} maxLength={2048} placeholder="https://example.com/community-icon.png" /></div></label></div></section> : null}

          {step === 2 ? <section className="typed-community-wizard__step" aria-labelledby="community-access-heading"><div className="typed-community-wizard__intro"><span className="eyebrow">Final setup</span><h3 id="community-access-heading">Choose access and starter setup</h3><p>Visibility is enforced by Supabase policies; frontend controls are not the security boundary.</p></div><div className="community-visibility-grid" role="radiogroup" aria-label="Community visibility"><button type="button" role="radio" aria-checked={visibility === "public"} className={visibility === "public" ? "selected" : ""} onClick={() => setVisibility("public")}><AppIcon name="users" size="lg" /><strong>Public</strong><span>Discoverable community metadata with an optional public read policy.</span></button><button type="button" role="radio" aria-checked={visibility === "private"} className={visibility === "private" ? "selected" : ""} onClick={() => { setVisibility("private"); setPublicReadEnabled(false); }}><AppIcon name="lock" size="lg" /><strong>Private</strong><span>Membership or invite is required before community content can be read.</span></button></div><label className={`typed-community-wizard__policy ${visibility === "private" ? "disabled" : ""}`}><input type="checkbox" checked={visibility === "public" && publicReadEnabled} disabled={visibility === "private"} onChange={(event) => setPublicReadEnabled(event.target.checked)} /><span><strong>Allow public read</strong><small>Visitors may read non-private content but cannot participate.</small></span></label>
            {kind === "text" ? <div className="typed-community-wizard__templates"><div><strong>Starter template</strong><span>Optional channel structure for the Text community.</span></div><div className="template-picker" aria-label="Community template selection">{communityTemplates.map((template) => <button key={template.id} type="button" className={template.id === templateId ? "selected" : ""} onClick={() => setTemplateId(template.id)}><strong>{template.name}</strong><span>{template.description}</span></button>)}</div><div className="template-preview"><strong>{selectedTemplate.name} preview</strong><span>{textTemplateChannels.length} channels prepared</span><ul>{textTemplateChannels.slice(0, 6).map((channel) => <li key={`${selectedTemplate.id}-${channel.name}`}>{channel.type === "voice" ? "voice" : "#"} {channel.name}</li>)}</ul></div></div> : <div className="typed-community-wizard__type-summary"><span><AppIcon name={selectedKind?.icon ?? "home"} size="lg" /></span><div><strong>{selectedKind?.title}</strong><p>{kind === "radio" ? "Picom will open the live radio shell. Broadcast setup remains separate from text channels." : "Picom will open the podcast publishing shell. Episodes remain separate from text channels."}</p></div></div>}
          </section> : null}
        </div>

        {error ? <div className="auth-error typed-community-wizard__error" role="alert">{error}</div> : null}
        <footer className="typed-community-wizard__footer"><button type="button" className="secondary-action" onClick={step === 0 ? onClose : () => { setStep((current) => Math.max(0, current - 1)); setError(null); }} disabled={saving}>{step === 0 ? "Cancel" : "Back"}</button>{step < STEPS.length - 1 ? <button type="button" className="send-button" onClick={goNext} disabled={saving || (step === 0 && !kind)}>{step === 0 ? "Continue" : "Next"}<AppIcon name="chevronRight" size="sm" /></button> : <button type="button" className="send-button" onClick={() => void submit()} disabled={saving || !kind || !name.trim()}><AppIcon name="plus" size="sm" />{saving ? "Creating..." : `Create ${selectedKind?.title ?? "community"}`}</button>}</footer>
      </section>
    </div>
  );
}
