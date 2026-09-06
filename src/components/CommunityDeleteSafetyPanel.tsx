import { useEffect, useRef, useState } from "react";
import { communityDeleteSafetyService, type CommunityDeletionStatus } from "../services/communityDeleteSafetyService";
import { featureFlagService } from "../services/featureFlagService";
import { translateSettings } from "../services/settings/settingsI18n";
import { settingsService } from "../services/settingsService";
import type { Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import "./CommunityDangerZone.css";

type CommunityDeleteSafetyPanelProps = { community: Community; currentUser: Member };

function isCurrentUserOwner(community: Community, currentUser: Member): boolean {
  return community.roles.find((role) => role.id === currentUser.roleId)?.name === "Owner";
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

/**
 * The recovery state is always loaded from the canonical RPC. No archived
 * community state, password, or confirmation text is persisted in the client.
 */
export function CommunityDeleteSafetyPanel({ community, currentUser }: CommunityDeleteSafetyPanelProps) {
  const language = settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) => translateSettings(key, language, params);
  const [status, setStatus] = useState<CommunityDeletionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creationEnabled, setCreationEnabled] = useState(() => featureFlagService.isEnabled("COMMUNITY_30_DAY_DELETION_ENABLED"));
  const confirmationDialogRef = useRef<HTMLElement | null>(null);
  const canManageDeletion = isCurrentUserOwner(community, currentUser);

  useEffect(() => featureFlagService.subscribe((snapshot) => {
    setCreationEnabled(snapshot.flags.COMMUNITY_30_DAY_DELETION_ENABLED);
  }), []);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setErrorMessage("");
    void communityDeleteSafetyService.getStatus(community.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setStatus(result.data);
      else setErrorMessage(result.message || t("community.deletion.error"));
    });
    return () => {
      cancelled = true;
    };
  }, [community.id, language]);

  useEffect(() => {
    if (confirmOpen) confirmationDialogRef.current?.focus();
  }, [confirmOpen]);

  if (!canManageDeletion) return null;

  const scheduledAt = status?.scheduledDeletionAt ?? null;
  if (!scheduledAt && !creationEnabled) return null;

  async function requestDeletion() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityDeleteSafetyService.requestDeletion(community.id);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message || t("community.deletion.error"));
      return;
    }
    setStatus(result.data);
    setConfirmOpen(false);
  }

  async function cancelDeletion() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityDeleteSafetyService.cancelDeletion(community.id);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message || t("community.deletion.error"));
      return;
    }
    setStatus(result.data);
  }

  return (
    <>
      <section className="community-danger-action-card community-danger-action-card--delete" aria-label={t("community.deletion.title")}>
        <header className="community-danger-action-header">
          <span className="community-danger-action-icon" aria-hidden="true">
            <AppIcon name="trash" size="sm" />
          </span>
          <div>
            <strong>{t("community.deletion.title")}</strong>
            <small>{t("community.deletion.body")}</small>
          </div>
        </header>

        {scheduledAt ? (
          <>
            <p className="community-danger-warning">
              <AppIcon name="calendar" size="sm" />
              {t("community.deletion.pending", { name: community.name, date: formatDate(scheduledAt, language) })}
            </p>
            <footer className="community-danger-action-footer">
              <button type="button" className="community-mgmt-action" disabled={submitting} onClick={() => void cancelDeletion()}>
                {submitting ? t("community.deletion.working") : t("community.deletion.cancelAction")}
              </button>
            </footer>
          </>
        ) : (
          <footer className="community-danger-action-footer">
            <button type="button" className="community-mgmt-action community-mgmt-action--danger" disabled={submitting} onClick={() => setConfirmOpen(true)}>
              {t("community.deletion.request")}
            </button>
          </footer>
        )}

        {errorMessage ? <p className="community-mgmt-notice is-error" role="alert">{errorMessage}</p> : null}
      </section>

      {confirmOpen ? (
        <div className="community-delete-confirm-backdrop" role="presentation" onMouseDown={() => !submitting && setConfirmOpen(false)}>
          <section
            ref={confirmationDialogRef}
            className="community-delete-confirm-dialog"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="community-delete-confirm-title"
            aria-describedby="community-delete-confirm-description"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !submitting) setConfirmOpen(false);
            }}
          >
            <h3 id="community-delete-confirm-title">{t("community.deletion.confirmTitle")}</h3>
            <p id="community-delete-confirm-description">{t("community.deletion.confirmBody", { name: community.name })}</p>
            <div className="community-delete-confirm-actions">
              <button type="button" className="community-mgmt-action" disabled={submitting} onClick={() => setConfirmOpen(false)}>
                {t("community.deletion.cancel")}
              </button>
              <button type="button" className="community-mgmt-action community-mgmt-action--danger" disabled={submitting} onClick={() => void requestDeletion()}>
                {submitting ? t("community.deletion.working") : t("community.deletion.request")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
