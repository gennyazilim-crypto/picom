import { SecretAwareJoinWithInviteModal, SecretInvitePeoplePanel } from "./SecretCommunityFlows";
import { useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityInviteService, type CommunityInvite, type CommunityInvitePreview, type InviteAcceptanceStatus, type InviteCampaignSummary } from "../services/community/communityInviteService";
import { getCommunityKindInviteSummary } from "../services/community/communityJoinRoutingService";
import { clipboardService } from "../services/clipboardService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";

function InviteModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="community-access-modal invite-flow-modal" role="dialog" aria-modal="true" aria-labelledby="invite-flow-title" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button modal-close" type="button" aria-label="Close community invite" onClick={onClose}><AppIcon name="close" size="lg" /></button><p className="eyebrow">Community invite</p><h2 id="invite-flow-title">{title}</h2>{children}</section></div>;
}

export function InvitePeopleModal(props: { community: Community; currentUserId: string; canCreate: boolean; onClose: () => void }) {
  if (props.community.visibility === "secret") return <SecretInvitePeoplePanel {...props} />;
  return <StandardInvitePeopleModal {...props} />;
}

function StandardInvitePeopleModal({ community, currentUserId, canCreate, onClose }: { community: Community; currentUserId: string; canCreate: boolean; onClose: () => void }) {
  const [maxUses, setMaxUses] = useState("10");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [campaignLabel, setCampaignLabel] = useState("Community invite");
  const [invite, setInvite] = useState<CommunityInvite | null>(null);
  const [campaigns, setCampaigns] = useState<InviteCampaignSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kindSummary = getCommunityKindInviteSummary(community.kind);
  useEffect(() => { if (!canCreate) return; let active = true; void communityInviteService.listInviteCampaigns(community.id).then((result) => { if (active && result.ok) setCampaigns(result.data); }); return () => { active = false; }; }, [canCreate, community.id]);
  const create = async () => {
    setBusy(true); setMessage(null);
    const result = await communityInviteService.createInvite({ communityId: community.id, createdBy: currentUserId, canCreate, maxUses: maxUses.trim() ? Number.parseInt(maxUses, 10) : null, expiresInDays: expiresInDays.trim() ? Number.parseInt(expiresInDays, 10) : null, campaignLabel });
    if (result.ok) { setInvite(result.data); const listed = await communityInviteService.listInviteCampaigns(community.id); if (listed.ok) setCampaigns(listed.data); } else setMessage(result.error.message);
    setBusy(false);
  };
  const copy = async () => {
    if (!invite) return;
    const result = await clipboardService.copyText(communityInviteService.getInviteLink(invite.code));
    setMessage(result.ok ? "Invite link copied." : result.reason);
  };
  const revoke = async () => {
    if (!invite) return;
    setBusy(true); setMessage(null);
    const result = await communityInviteService.revokeInvite(invite.id);
    if (result.ok) { setInvite(result.data); setMessage("Invite revoked."); const listed = await communityInviteService.listInviteCampaigns(community.id); if (listed.ok) setCampaigns(listed.data); } else setMessage(result.error.message);
    setBusy(false);
  };
  return <InviteModalShell title={`Invite people to ${community.name}`} onClose={onClose}><div className="invite-flow-content"><p>Create a limited invite. Picom tracks aggregate uses only; no IP, device, referrer, or fingerprint analytics are collected.</p><div className="community-admin-note"><AppIcon name="send" size="sm" /><span>This {kindSummary.label.toLowerCase()} invite opens at {kindSummary.landingLabel}. Private communities remain unavailable without a valid invite or approved membership.</span></div><label><span>Campaign label</span><input maxLength={80} value={campaignLabel} onChange={(event) => setCampaignLabel(event.target.value)} placeholder="Community invite" /></label><div className="invite-options"><label><span>Maximum uses</span><input type="number" min="1" max="100" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label><label><span>Expires in days</span><input type="number" min="1" max="30" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} /></label></div>{invite ? <div className="invite-result"><span>{invite.revokedAt ? "Revoked invite" : "Invite link"}</span><strong>{communityInviteService.getInviteLink(invite.code)}</strong><small>{invite.uses} / {invite.maxUses ?? "unlimited"} uses</small><div className="invite-result-actions"><button type="button" disabled={Boolean(invite.revokedAt)} onClick={() => void copy()}><AppIcon name="paperclip" size="sm" /> Copy link</button><button className="danger-action" type="button" disabled={Boolean(invite.revokedAt) || busy} onClick={() => void revoke()}><AppIcon name="trash" size="sm" /> Revoke</button></div></div> : null}{campaigns.length ? <div className="session-list" aria-label="Invite campaign summaries">{campaigns.slice(0, 6).map((campaign) => <article key={campaign.id} className="session-card"><div><strong>{campaign.campaignLabel ?? "Community invite"}</strong><small>{campaign.uses} / {campaign.maxUses ?? "unlimited"} uses - by {campaign.creatorName} - {communityInviteService.getLifecycleStatus(campaign)}</small></div></article>)}</div> : null}{message ? <p className="invite-flow-message" role="status">{message}</p> : null}<div className="modal-actions-row"><button className="secondary-action" type="button" onClick={onClose}>Close</button><button className="send-button" type="button" disabled={!canCreate || busy} onClick={() => void create()}><AppIcon name="plus" size="sm" />{busy ? "Creating..." : "Create invite"}</button></div></div></InviteModalShell>;
}

export function JoinWithInviteModal(props: { initialCode?: string; isAuthenticated: boolean; communities: Community[]; currentUser: Member; onClose: () => void; onAccepted: (communityId: string, member: Member, status: InviteAcceptanceStatus, preview: CommunityInvitePreview) => void | Promise<void> }) {
  return <SecretAwareJoinWithInviteModal {...props} />;
}