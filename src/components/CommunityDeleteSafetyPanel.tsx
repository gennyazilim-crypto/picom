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

  const canPrepareDelete = isCurrentUserOwner(community, currentUser);

  useEffect(() => {
    setStatus(communityDeleteSafetyService.getStatus(community.id));
    setConfirmationName("");
  }, [community.id]);

  if (!canPrepareDelete) {
    return null;
  }

  function prepareDelete() {
    const result = communityDeleteSafetyService.requestSoftDeletePlaceholder(community, currentUser, confirmationName);
    if (!result.ok) {
      setStatus({
        communityId: community.id,
        requestedAt: new Date().toISOString(),
        requestedByUserId: currentUser.userId,
        status: "soft_delete_placeholder",
        message: result.message,
      });
      return;
    }

    setStatus(result.data);
    setConfirmationName("");
  }

  function clearDeletePlaceholder() {
    communityDeleteSafetyService.clearPlaceholder(community.id);
    setStatus(null);
    setConfirmationName("");
  }

  return (
    <section className="community-delete-safety-card" aria-label="Community delete safety placeholder">
      <div className="community-delete-safety-head">
        <span>
          <AppIcon name="trash" size="sm" />
        </span>
        <div>
          <strong>Delete safety</strong>
          <small>Owner-only soft delete placeholder.</small>
        </div>
      </div>
      <input value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={`Type ${community.name}`} aria-label="Confirm community delete placeholder" />
      <div className="community-delete-safety-actions">
        <button type="button" disabled={confirmationName.trim() !== community.name} onClick={prepareDelete}>Prepare delete</button>
        <button type="button" onClick={clearDeletePlaceholder}>Clear</button>
      </div>
      {status ? <small className="community-delete-safety-status">{status.message}</small> : null}
    </section>
  );
}