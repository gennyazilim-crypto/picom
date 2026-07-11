import { useEffect, useMemo, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityOwnershipTransferService, type OwnershipTransferStatus } from "../services/communityOwnershipTransferService";
import { AppIcon } from "./AppIcon";

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
  const [status, setStatus] = useState<OwnershipTransferStatus | null>(() => communityOwnershipTransferService.getStatus(community.id));
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPrepareTransfer = isCurrentUserOwner(community, currentUser);
  const eligibleMembers = useMemo(() => community.members.filter((member) => member.userId !== currentUser.userId), [community.members, currentUser.userId]);

  useEffect(() => {
    setStatus(communityOwnershipTransferService.getStatus(community.id));
    setTargetUserId(eligibleMembers[0]?.userId ?? "");
    setConfirmationName("");
    setErrorMessage("");
  }, [community.id, eligibleMembers]);

  if (!canPrepareTransfer) {
    return null;
  }

  async function transferOwnership() {
    setSubmitting(true);
    setErrorMessage("");
    const result = await communityOwnershipTransferService.transferOwnership(community, currentUser, targetUserId, confirmationName);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatus(result.data);
    setConfirmationName("");
  }

  return (
    <section className="ownership-transfer-card" aria-label="Community ownership transfer">
      <div className="ownership-transfer-head">
        <span>
          <AppIcon name="users" size="sm" />
        </span>
        <div>
          <strong>Ownership transfer</strong>
          <small>Atomically moves ownership to an existing member and records an audit event.</small>
        </div>
      </div>
      <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} aria-label="Select target owner">
        {eligibleMembers.map((member) => (
          <option key={member.id} value={member.userId}>{member.displayName}</option>
        ))}
      </select>
      <input value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={`Type ${community.name}`} aria-label="Confirm community name" />
      <div className="ownership-transfer-actions">
        <button type="button" disabled={submitting || status?.status === "completed" || !targetUserId || confirmationName.trim() !== community.name} onClick={() => void transferOwnership()}>{submitting ? "Transferring..." : "Transfer ownership"}</button>
      </div>
      {errorMessage ? <small className="ownership-transfer-status" role="alert">{errorMessage}</small> : null}
      {status ? <small className="ownership-transfer-status" role="status">{status.message}</small> : null}
    </section>
  );
}
