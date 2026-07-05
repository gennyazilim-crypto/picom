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

  const canPrepareTransfer = isCurrentUserOwner(community, currentUser);
  const eligibleMembers = useMemo(() => community.members.filter((member) => member.userId !== currentUser.userId), [community.members, currentUser.userId]);

  useEffect(() => {
    setStatus(communityOwnershipTransferService.getStatus(community.id));
    setTargetUserId(eligibleMembers[0]?.userId ?? "");
    setConfirmationName("");
  }, [community.id, eligibleMembers]);

  if (!canPrepareTransfer) {
    return null;
  }

  function prepareTransfer() {
    const result = communityOwnershipTransferService.requestTransferPlaceholder(community, currentUser, targetUserId, confirmationName);
    if (!result.ok) {
      setStatus({
        communityId: community.id,
        requestedAt: new Date().toISOString(),
        fromUserId: currentUser.userId,
        toUserId: targetUserId,
        targetDisplayName: "Not ready",
        status: "pending_placeholder",
        message: result.message,
      });
      return;
    }

    setStatus(result.data);
    setConfirmationName("");
  }

  function clearTransfer() {
    communityOwnershipTransferService.clearPlaceholder(community.id);
    setStatus(null);
    setConfirmationName("");
  }

  return (
    <section className="ownership-transfer-card" aria-label="Community ownership transfer placeholder">
      <div className="ownership-transfer-head">
        <span>
          <AppIcon name="users" size="sm" />
        </span>
        <div>
          <strong>Ownership transfer</strong>
          <small>Owner-only placeholder. No roles change yet.</small>
        </div>
      </div>
      <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} aria-label="Select target owner">
        {eligibleMembers.map((member) => (
          <option key={member.id} value={member.userId}>{member.displayName}</option>
        ))}
      </select>
      <input value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={`Type ${community.name}`} aria-label="Confirm community name" />
      <div className="ownership-transfer-actions">
        <button type="button" disabled={!targetUserId || confirmationName.trim() !== community.name} onClick={prepareTransfer}>Prepare transfer</button>
        <button type="button" onClick={clearTransfer}>Clear</button>
      </div>
      {status ? <small className="ownership-transfer-status">{status.message}{status.targetDisplayName !== "Not ready" ? ` Target: ${status.targetDisplayName}.` : ""}</small> : null}
    </section>
  );
}