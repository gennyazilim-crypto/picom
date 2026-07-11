import { useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityDeleteSafetyService, type CommunityDeleteSafetyStatus } from "../services/communityDeleteSafetyService";
import { AppIcon } from "./AppIcon";

type CommunityDeleteSafetyPanelProps = {
  community: Community;
  currentUser: Member;
};

function isCurrentUserOwner(community: Community, currentUser: Member): boolean {
  return community.roles.find((role) => role.id === currentUser.roleId)?.name === "Owner";
}

export function CommunityDeleteSafetyPanel({ community, currentUser }: CommunityDeleteSafetyPanelProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [status, setStatus] = useState<CommunityDeleteSafetyStatus | null>(() => communityDeleteSafetyService.getStatus(community.id));
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPrepareDelete = isCurrentUserOwner(community, currentUser);

  useEffect(() => {
    setStatus(communityDeleteSafetyService.getStatus(community.id));
    setConfirmationName("");
    setErrorMessage("");
  }, [community.id]);

  if (!canPrepareDelete) {
    return null;
  }

  async function archiveCommunity() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityDeleteSafetyService.archiveCommunity(community, currentUser, confirmationName);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatus(result.data);
    setConfirmationName("");
  }

  return (
    <section className="community-delete-safety-card" aria-label="Community archive safety">
      <div className="community-delete-safety-head">
        <span>
          <AppIcon name="trash" size="sm" />
        </span>
        <div>
          <strong>Delete safety</strong>
          <small>Archives access without deleting community content, audit logs, or security history.</small>
        </div>
      </div>
      <input value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={`Type ${community.name}`} aria-label="Confirm community archive" />
      <div className="community-delete-safety-actions">
        <button type="button" disabled={submitting || status?.status === "archived" || confirmationName.trim() !== community.name} onClick={() => void archiveCommunity()}>{submitting ? "Archiving..." : "Archive community"}</button>
      </div>
      {errorMessage ? <small className="community-delete-safety-status" role="alert">{errorMessage}</small> : null}
      {status ? <small className="community-delete-safety-status" role="status">{status.message}</small> : null}
    </section>
  );
}
