import { useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityDeleteSafetyService, type CommunityDeleteSafetyStatus } from "../services/communityDeleteSafetyService";
import { AppIcon } from "./AppIcon";
import "./CommunityDangerZone.css";

type CommunityDeleteSafetyPanelProps = { community: Community; currentUser: Member };

function isCurrentUserOwner(community: Community, currentUser: Member): boolean {
  return community.roles.find((role) => role.id === currentUser.roleId)?.name === "Owner";
}

export function CommunityDeleteSafetyPanel({ community, currentUser }: CommunityDeleteSafetyPanelProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [reason, setReason] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [status, setStatus] = useState<CommunityDeleteSafetyStatus | null>(() =>
    communityDeleteSafetyService.getStatus(community.id),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canPrepareDelete = isCurrentUserOwner(community, currentUser);

  useEffect(() => {
    setStatus(communityDeleteSafetyService.getStatus(community.id));
    setConfirmationName("");
    setReason("");
    setCurrentPassword("");
    setErrorMessage("");
  }, [community.id]);

  if (!canPrepareDelete) return null;

  async function archiveCommunity() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityDeleteSafetyService.archiveCommunity(
      community,
      currentUser,
      confirmationName,
      reason,
      currentPassword,
    );
    setCurrentPassword("");
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    setStatus(result.data);
    setConfirmationName("");
    setReason("");
  }

  const ready = confirmationName.trim() === community.name && reason.trim().length >= 10 && currentPassword.length >= 8;

  return (
    <section className="community-danger-action-card community-danger-action-card--archive" aria-label="Community archive safety">
      <header className="community-danger-action-header">
        <span className="community-danger-action-icon" aria-hidden="true">
          <AppIcon name="trash" size="sm" />
        </span>
        <div>
          <strong>Archive community</strong>
          <small>Disables access without hard-deleting content, audit logs, or security history.</small>
        </div>
      </header>

      <p className="community-danger-warning">
        <AppIcon name="lock" size="sm" />
        Archive removes the community from normal access. Recovery is an operations-controlled restore after integrity checks.
      </p>

      <label className="community-mgmt-field">
        <span>Archive reason</span>
        <textarea
          className="community-mgmt-textarea"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this community is being archived"
        />
      </label>

      <label className="community-mgmt-field">
        <span>Type the community name</span>
        <input
          className="community-mgmt-input"
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          placeholder={community.name}
          aria-label="Confirm community archive"
        />
      </label>

      <label className="community-mgmt-field">
        <span>Current password</span>
        <input
          className="community-mgmt-input"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Re-authenticate to archive"
          aria-label="Current password for community archive"
        />
      </label>

      <footer className="community-danger-action-footer">
        <button
          type="button"
          className="community-mgmt-action community-mgmt-action--danger"
          disabled={submitting || status?.status === "archived" || !ready}
          onClick={() => void archiveCommunity()}
        >
          {submitting ? "Verifying and archiving…" : "Archive community"}
        </button>
      </footer>

      {errorMessage ? (
        <p className="community-mgmt-notice is-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {status ? (
        <p className="community-mgmt-notice" role="status">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
