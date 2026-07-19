import { useEffect, useMemo, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityOwnershipTransferService, type OwnershipTransferStatus } from "../services/communityOwnershipTransferService";
import { AppIcon } from "./AppIcon";
import "./CommunityDangerZone.css";

type CommunityOwnershipTransferPanelProps = {
  community: Community;
  currentUser: Member;
};

function isCurrentUserOwner(community: Community, currentUser: Member): boolean {
  return community.roles.find((role) => role.id === currentUser.roleId)?.name === "Owner";
}

export function CommunityOwnershipTransferPanel({ community, currentUser }: CommunityOwnershipTransferPanelProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmationName, setConfirmationName] = useState("");
  const [reason, setReason] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [status, setStatus] = useState<OwnershipTransferStatus | null>(() =>
    communityOwnershipTransferService.getStatus(community.id),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPrepareTransfer = isCurrentUserOwner(community, currentUser);
  const eligibleMembers = useMemo(
    () => community.members.filter((member) => member.userId !== currentUser.userId),
    [community.members, currentUser.userId],
  );

  useEffect(() => {
    setStatus(communityOwnershipTransferService.getStatus(community.id));
    setTargetUserId(eligibleMembers[0]?.userId ?? "");
    setConfirmationName("");
    setReason("");
    setCurrentPassword("");
    setErrorMessage("");
  }, [community.id, eligibleMembers]);

  if (!canPrepareTransfer) return null;

  async function transferOwnership() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityOwnershipTransferService.transferOwnership(
      community,
      currentUser,
      targetUserId,
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

  const ready =
    Boolean(targetUserId) &&
    confirmationName.trim() === community.name &&
    reason.trim().length >= 10 &&
    currentPassword.length >= 8;

  return (
    <section className="community-danger-action-card community-danger-action-card--transfer" aria-label="Community ownership transfer">
      <header className="community-danger-action-header">
        <span className="community-danger-action-icon" aria-hidden="true">
          <AppIcon name="users" size="sm" />
        </span>
        <div>
          <strong>Ownership transfer</strong>
          <small>Moves ownership and primary roles atomically to an active member.</small>
        </div>
      </header>

      <p className="community-danger-warning">
        <AppIcon name="lock" size="sm" />
        You immediately lose owner-only controls after a successful transfer. A failed transaction changes nothing.
      </p>

      {eligibleMembers.length ? (
        <label className="community-mgmt-field">
          <span>New owner</span>
          <select
            className="community-mgmt-select"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            aria-label="Select target owner"
          >
            {eligibleMembers.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.displayName} (@{member.username})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="community-danger-warning">Add another active member before transferring ownership.</p>
      )}

      <label className="community-mgmt-field">
        <span>Reason</span>
        <textarea
          className="community-mgmt-textarea"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain the ownership handoff for the audit log"
        />
      </label>

      <label className="community-mgmt-field">
        <span>Type the community name</span>
        <input
          className="community-mgmt-input"
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          placeholder={community.name}
          aria-label="Confirm community name"
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
          placeholder="Re-authenticate to transfer"
          aria-label="Current password for ownership transfer"
        />
      </label>

      <footer className="community-danger-action-footer">
        <button
          type="button"
          className="community-mgmt-action community-mgmt-action--danger"
          disabled={submitting || status?.status === "completed" || !ready}
          onClick={() => void transferOwnership()}
        >
          {submitting ? "Verifying and transferring…" : "Transfer ownership"}
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
