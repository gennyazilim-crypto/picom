import { SecretCommunityEligibilityPanel } from "./SecretCommunityFlows";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { isV1CommunityKindEnabled } from "../config/v1ReleaseScope";
import { communityTemplates } from "../data/communityTemplates";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { communityBrandingService } from "../services/communityBrandingService";
import type { CommunityKind } from "../types/community";
import type { CommunityTemplateId } from "../types/communityTemplates";
import { AppIcon, type IconName } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import "./CreateCommunityModal.css";

const overlayIcons = mvpUiIconMap.overlays;

export type CreateCommunityFormValue = Readonly<{
  creationRequestId: string;
  kind: CommunityKind;
  name: string;
  description?: string;
  iconFile?: File;
  visibility: "public" | "secret";
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

type TextCommunitySuggestion = Readonly<{
  id: string;
  label: string;
  name: string;
  description: string;
}>;

const KIND_OPTIONS: readonly KindOption[] = [
  {
    kind: "text",
    title: "Text Community",
    description: "A structured space for channels, messages, files, roles, and voice rooms.",
    capabilities: ["Text and voice channels", "Replies, reactions, and attachments", "Roles, moderation, and audit log"],
    limitation: "Does not publish live radio or podcast episodes.",
    icon: "hash",
  },
  {
    kind: "radio",
    title: "Radio Community",
    description: "A live-first station for scheduled broadcasts, hosts, and listener sessions.",
    capabilities: ["Live and scheduled radio", "Host and listener presence", "Broadcast-focused community shell"],
    limitation: "Does not use the normal text-channel tree.",
    icon: "microphone",
  },
  {
    kind: "podcast",
    title: "Podcast Community",
    description: "An on-demand publishing space for shows, episodes, creators, and listeners.",
    capabilities: ["Episode publishing", "Series and creator context", "On-demand playback shell"],
    limitation: "Does not use the normal text-channel tree.",
    icon: "headphones",
  },
] as const;

const TEXT_COMMUNITY_SUGGESTIONS: readonly TextCommunitySuggestion[] = [
  {
    id: "school",
    label: "School",
    name: "School Community",
    description: "Classes, clubs, announcements, and study channels for your school.",
  },
  {
    id: "work",
    label: "Work",
    name: "Work Hub",
    description: "Teams, projects, and day-to-day collaboration for your workplace.",
  },
  {
    id: "gaming",
    label: "Gaming",
    name: "Gaming Crew",
    description: "Squads, LFG, voice rooms, and game-night coordination.",
  },
  {
    id: "club",
    label: "Club",
    name: "Club House",
    description: "Members, events, and shared channels for your club or interest group.",
  },
  {
    id: "study",
    label: "Study group",
    name: "Study Group",
    description: "Notes, deadlines, and focus sessions with classmates.",
  },
  {
    id: "friends",
    label: "Friends",
    name: "Friends Circle",
    description: "A private space for friends to chat, share, and hang out.",
  },
] as const;

const STEPS = ["Community type", "Identity", "Access & setup"] as const;

export function CreateCommunityModal({ onClose, onSubmit }: CreateCommunityModalProps) {
  const [creationRequestId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<CommunityKind | null>("text");
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "secret">("public");
  const [publicReadEnabled, setPublicReadEnabled] = useState(true);
  const [secretEligible, setSecretEligible] = useState(false);
  const [templateId, setTemplateId] = useState<CommunityTemplateId>("custom");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const selectedTemplate = communityTemplates.find((template) => template.id === templateId) ?? communityTemplates[0];
  const selectedKind = KIND_OPTIONS.find((option) => option.kind === kind) ?? null;
  const selectedSuggestion = TEXT_COMMUNITY_SUGGESTIONS.find((item) => item.id === suggestionId) ?? null;
  const dialogRef = useDialogFocusTrap<HTMLElement>(saving ? () => undefined : onClose);
  const textTemplateChannels = useMemo(() => selectedTemplate.categories.flatMap((category) => category.channels), [selectedTemplate]);
  const nameLength = name.trim().length;
  const descriptionLength = description.length;
  const monogram = name.trim().slice(0, 1).toUpperCase() || "#";

  useEffect(() => () => {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
  }, [iconPreview]);

  const clearIconInput = () => {
    if (iconInputRef.current) iconInputRef.current.value = "";
  };

  const selectIconFile = (file: File | null) => {
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (!file) {
      setIconFile(null);
      setIconError(null);
      clearIconInput();
      return;
    }
    const validation = communityBrandingService.validate(file, "icon");
    if (!validation.ok) {
      setIconFile(null);
      setIconError(validation.message);
      clearIconInput();
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setIconError(null);
  };

  const validateIdentity = (): string | null => {
    const cleanedName = name.trim().replace(/\s+/g, " ");
    if (!cleanedName) return "Community name is required.";
    if (cleanedName.length > 80) return "Community name must be 80 characters or fewer.";
    if (description.trim().length > 500) return "Description must be 500 characters or fewer.";
    if (iconError) return iconError;
    return null;
  };

  const goNext = () => {
    setError(null);
    if (step === 0 && (!kind || !isV1CommunityKindEnabled(kind))) {
      setError("Choose Text Community before continuing. Radio and Podcast are locked for now.");
      return;
    }
    if (step === 1) {
      const identityError = validateIdentity();
      if (identityError) {
        setError(identityError);
        return;
      }
    }
    if (step === 0 && !iconFile) setIconError(null);
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const submit = async () => {
    if (!kind || !isV1CommunityKindEnabled(kind)) {
      setStep(0);
      setError("Choose Text Community before creating it. Radio and Podcast are locked for now.");
      return;
    }
    const identityError = validateIdentity();
    if (identityError) {
      setStep(1);
      setError(identityError);
      return;
    }
    if (visibility !== "public" && visibility !== "secret") {
      setError("Choose a valid community visibility.");
      return;
    }
    if (visibility === "secret" && !secretEligible) {
      setError("Complete phone and voice-call verification before creating a secret community.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        creationRequestId,
        kind,
        name: name.trim().replace(/\s+/g, " "),
        description: description.trim() || undefined,
        iconFile: iconFile ?? undefined,
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

  const selectKind = (nextKind: CommunityKind) => {
    if (!isV1CommunityKindEnabled(nextKind)) return;
    setKind(nextKind);
    setTemplateId("custom");
    setError(null);
    if (nextKind !== "text") setSuggestionId(null);
  };

  const applySuggestion = (suggestion: TextCommunitySuggestion) => {
    selectKind("text");
    setSuggestionId(suggestion.id);
    setName(suggestion.name);
    setDescription(suggestion.description);
    setError(null);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!saving) onClose(); }}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="create-community-modal typed-community-wizard"
        aria-modal="true"
        role="dialog"
        aria-labelledby="create-community-title"
        aria-describedby="create-community-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-button modal-close" aria-label="Close create community" onClick={onClose} disabled={saving}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        <header className="typed-community-wizard__header">
          <div>
            <span className="eyebrow">New community</span>
            <h2 id="create-community-title">Create a Picom community</h2>
            <p id="create-community-description">
              Text communities are available now. Radio and Podcast stay locked until a later release.
            </p>
          </div>
          <span className="typed-community-wizard__step-count">Step {step + 1} of {STEPS.length}</span>
        </header>
        <ol className="typed-community-wizard__progress" aria-label="Community creation progress">
          {STEPS.map((label, index) => (
            <li key={label} className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} aria-current={index === step ? "step" : undefined}>
              <span>{index < step ? "OK" : index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>

        <div className="typed-community-wizard__body">
          {step === 0 ? (
            <section className="typed-community-wizard__step" aria-labelledby="community-kind-heading">
              <div className="typed-community-wizard__intro">
                <span className="eyebrow">Required</span>
                <h3 id="community-kind-heading">What are you creating?</h3>
                <p>The selected type controls capabilities, navigation, and the shell opened after creation.</p>
              </div>
              <div className="community-kind-grid" role="radiogroup" aria-label="Community type">
                {KIND_OPTIONS.map((option, index) => {
                  const enabled = isV1CommunityKindEnabled(option.kind);
                  const selected = kind === option.kind && enabled;
                  return (
                    <div
                      key={option.kind}
                      className={`community-kind-option ${selected ? "selected" : ""} ${enabled ? "" : "community-kind-option--locked"}`}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-disabled={!enabled}
                        disabled={!enabled}
                        className={`community-kind-card ${selected ? "selected" : ""} ${enabled ? "" : "community-kind-card--locked"}`}
                        onClick={() => selectKind(option.kind)}
                        data-dialog-initial-focus={index === 0 ? true : undefined}
                      >
                        <span className="community-kind-card__icon">
                          <AppIcon name={option.icon} size="xl" />
                        </span>
                        <span className="community-kind-card__copy">
                          <strong>
                            {option.title}
                            {!enabled ? <span className="community-kind-card__badge">Locked</span> : null}
                          </strong>
                          <small>{option.description}</small>
                        </span>
                        <ul>
                          {option.capabilities.map((capability) => (
                            <li key={capability}>{capability}</li>
                          ))}
                        </ul>
                        <span className="community-kind-card__limit">
                          <AppIcon name="lock" size="xs" />
                          {enabled ? option.limitation : "Coming in a later Picom release."}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="typed-community-wizard__step typed-community-wizard__step--identity" aria-labelledby="community-identity-heading">
              <div className="typed-community-wizard__intro">
                <span className="eyebrow">{selectedKind?.title}</span>
                <h3 id="community-identity-heading">Give the community an identity</h3>
                <p>Pick a starting idea or write your own. You can refine the description and logo later in community settings.</p>
              </div>

              {kind === "text" ? (
                <div className="community-identity-suggestions" role="group" aria-label="Text community suggestions">
                  <div className="community-identity-suggestions__header">
                    <strong>Ideas to start with</strong>
                    <span>Optional presets fill the name and description — edit freely after.</span>
                  </div>
                  <div className="community-kind-card__suggestion-chips">
                    {TEXT_COMMUNITY_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className={`community-kind-suggestion ${suggestionId === suggestion.id ? "selected" : ""}`}
                        onClick={() => applySuggestion(suggestion)}
                        aria-pressed={suggestionId === suggestion.id}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                  {selectedSuggestion ? (
                    <p className="community-identity-suggestions__hint">
                      Using <strong>{selectedSuggestion.label}</strong> — name and description are prefilled below.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="community-identity-layout">
                <div className="community-identity-layout__fields">
                  <label className="auth-field community-identity-field">
                    <span className="community-identity-field__label">
                      <span>Community name</span>
                      <span className={`community-identity-field__count ${nameLength === 0 ? "is-empty" : ""}`}>{nameLength}/80</span>
                    </span>
                    <input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setSuggestionId(null);
                      }}
                      maxLength={80}
                      autoFocus
                      data-dialog-initial-focus
                      placeholder="e.g. Northside School, Studio Night, or Aurora Gaming"
                      aria-required="true"
                    />
                  </label>

                  <label className="auth-field community-identity-field">
                    <span className="community-identity-field__label">
                      <span>
                        Description <span className="optional-label">optional</span>
                      </span>
                      <span className="community-identity-field__count">{descriptionLength}/500</span>
                    </span>
                    <textarea
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value);
                        setSuggestionId(null);
                      }}
                      maxLength={500}
                      rows={5}
                      placeholder="What should members know about this community?"
                    />
                  </label>
                </div>

                <aside className="community-identity-brand" aria-label="Community logo">
                  <div className="community-identity-brand__preview" aria-hidden="true">
                    {iconPreview ? <img src={iconPreview} alt="" /> : <span>{monogram}</span>}
                  </div>
                  <div className="community-identity-brand__copy">
                    <strong>Community logo</strong>
                    <small>Optional. PNG, JPG, or WEBP · max 2 MB</small>
                    {iconFile ? <span className="community-identity-brand__file">{iconFile.name}</span> : null}
                  </div>
                  <div className="community-identity-brand__actions">
                    <label className="secondary-action typed-community-wizard__file-trigger">
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={saving}
                        onChange={(event) => selectIconFile(event.target.files?.[0] ?? null)}
                      />
                      <AppIcon name="image" size="sm" />
                      {iconFile ? "Replace logo" : "Choose logo"}
                    </label>
                    {iconFile ? (
                      <button type="button" className="secondary-action" disabled={saving} onClick={() => selectIconFile(null)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {iconError ? (
                    <p className="typed-community-wizard__logo-error" role="alert">
                      {iconError}
                    </p>
                  ) : (
                    <p className="community-identity-brand__hint">A monogram is used until you add a logo.</p>
                  )}
                </aside>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="typed-community-wizard__step typed-community-wizard__step--access" aria-labelledby="community-access-heading">
              <div className="typed-community-wizard__intro">
                <span className="eyebrow">Final setup</span>
                <h3 id="community-access-heading">Access and starter channels</h3>
                <p>Choose who can find this community, then pick an optional channel layout to start with.</p>
              </div>

              <div className="community-access-section">
                <div className="community-access-section__header">
                  <strong>Visibility</strong>
                  <span>You can change this later in community settings.</span>
                </div>
                <div className="community-visibility-grid" role="radiogroup" aria-label="Community visibility">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={visibility === "public"}
                    className={`community-visibility-card ${visibility === "public" ? "selected" : ""}`}
                    onClick={() => setVisibility("public")}
                  >
                    <span className="community-visibility-card__icon" aria-hidden="true">
                      <AppIcon name="users" size="lg" />
                    </span>
                    <span className="community-visibility-card__copy">
                      <strong>Public</strong>
                      <small>Listed in discovery. Anyone can join.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={visibility === "secret"}
                    className={`community-visibility-card ${visibility === "secret" ? "selected" : ""}`}
                    onClick={() => {
                      setVisibility("secret");
                      setPublicReadEnabled(false);
                    }}
                  >
                    <span className="community-visibility-card__icon" aria-hidden="true">
                      <AppIcon name="lock" size="lg" />
                    </span>
                    <span className="community-visibility-card__copy">
                      <strong>Secret</strong>
                      <small>Invite-only. Hidden from discovery and feeds.</small>
                    </span>
                  </button>
                </div>

                {visibility === "public" ? (
                  <label className="typed-community-wizard__policy">
                    <input type="checkbox" checked={publicReadEnabled} onChange={(event) => setPublicReadEnabled(event.target.checked)} />
                    <span>
                      <strong>Allow public read</strong>
                      <small>Non-members can browse public channels without joining.</small>
                    </span>
                  </label>
                ) : (
                  <p className="community-access-note">
                    Secret communities require phone and voice verification before creation.
                  </p>
                )}
              </div>

              {visibility === "secret" ? <SecretCommunityEligibilityPanel onEligibilityChange={setSecretEligible} /> : null}

              {kind === "text" ? (
                <div className="community-access-section community-access-section--templates">
                  <div className="community-access-section__header">
                    <strong>Starter template</strong>
                    <span>Optional. Sets the initial channel structure — editable after creation.</span>
                  </div>
                  <div className="community-template-layout">
                    <div className="template-picker community-template-picker" aria-label="Community template selection">
                      {communityTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className={template.id === templateId ? "selected" : ""}
                          onClick={() => setTemplateId(template.id)}
                          style={{ "--template-accent": template.accentColor } as CSSProperties}
                        >
                          <strong>{template.name}</strong>
                          <span>{template.description}</span>
                        </button>
                      ))}
                    </div>
                    <aside className="template-preview community-template-preview" aria-live="polite">
                      <div className="community-template-preview__header">
                        <strong>{selectedTemplate.name}</strong>
                        <span>{textTemplateChannels.length} channels</span>
                      </div>
                      <ul>
                        {textTemplateChannels.slice(0, 8).map((channel) => (
                          <li key={`${selectedTemplate.id}-${channel.name}`}>
                            <span className="community-template-preview__prefix" aria-hidden="true">
                              {channel.type === "voice" ? "voice" : channel.type === "announcement" ? "!" : "#"}
                            </span>
                            <span>{channel.name}</span>
                          </li>
                        ))}
                      </ul>
                      {textTemplateChannels.length > 8 ? (
                        <p className="community-template-preview__more">+{textTemplateChannels.length - 8} more after creation</p>
                      ) : null}
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="typed-community-wizard__type-summary">
                  <span>
                    <AppIcon name={selectedKind?.icon ?? "home"} size="lg" />
                  </span>
                  <div>
                    <strong>{selectedKind?.title}</strong>
                    <p>
                      {kind === "radio"
                        ? "Picom will open the live radio shell. Broadcast setup remains separate from text channels."
                        : "Picom will open the podcast publishing shell. Episodes remain separate from text channels."}
                    </p>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>

        {error ? (
          <div className="auth-error typed-community-wizard__error" role="alert">
            {error}
          </div>
        ) : null}
        <footer className="typed-community-wizard__footer">
          <button
            type="button"
            className="secondary-action"
            onClick={
              step === 0
                ? onClose
                : () => {
                    setStep((current) => Math.max(0, current - 1));
                    setError(null);
                  }
            }
            disabled={saving}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="send-button" onClick={goNext} disabled={saving || (step === 0 && (!kind || !isV1CommunityKindEnabled(kind)))}>
              {step === 0 ? "Continue" : "Next"}
              <AppIcon name="chevronRight" size="sm" />
            </button>
          ) : (
            <button type="button" className="send-button" onClick={() => void submit()} disabled={saving || !kind || !isV1CommunityKindEnabled(kind) || !name.trim() || (visibility === "secret" && !secretEligible)}>
              <AppIcon name="plus" size="sm" />
              {saving ? "Creating..." : `Create ${selectedKind?.title ?? "community"}`}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
