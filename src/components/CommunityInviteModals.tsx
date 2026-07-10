import { useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import { communityInviteService, type CommunityInvite, type InviteCampaignSummary } from "../services/community/communityInviteService";
import { clipboardService } from "../services/clipboardService";
import { AppIcon } from "./AppIcon";

function InviteModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="community-access-modal invite-flow-modal" role="dialog" aria-modal="true" aria-labelledby="invite-flow-title" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button modal-close" type="button" aria-label="Close" onClick={onClose}><AppIcon name="close" size="lg" /></button><p className="eyebrow">Community invite</p><h2 id="invite-flow-title">{title}</h2>{children}</section></div>;
}

export function InvitePeopleModal({ community, currentUserId, canCreate, onClose }: { community: Community; currentUserId: string; canCreate: boolean; onClose: () => void }) {
  const [maxUses, setMaxUses] = useState("10");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [campaignLabel, setCampaignLabel] = useState("Community invite");
  const [invite, setInvite] = useState<CommunityInvite | null>(null);
  const [campaigns, setCampaigns] = useState<InviteCampaignSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!canCreate) return; let active = true; void communityInviteService.listInviteCampaigns(community.id).then((result) => { if (active && result.ok) setCampaigns(result.data); }); return () => { active = false; }; }, [canCreate, community.id]);
  const create = async () => {
    setBusy(true); setMessage(null);
    const result = await communityInviteService.createInvite({ communityId: community.id, createdBy: currentUserId, canCreate, maxUses: maxUses ? Number(maxUses) : null, expiresInDays: expiresInDays ? Number(expiresInDays) : null, campaignLabel });
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
  return <InviteModalShell title={`Invite people to ${community.name}`} onClose={onClose}><div className="invite-flow-content"><p>Create a limited invite. Picom tracks aggregate uses only; no IP, device, referrer, or fingerprint analytics are collected.</p><label><span>Campaign label</span><input maxLength={80} value={campaignLabel} onChange={(event) => setCampaignLabel(event.target.value)} placeholder="Community invite" /></label><div className="invite-options"><label><span>Maximum uses</span><input type="number" min="1" max="100" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label><label><span>Expires in days</span><input type="number" min="1" max="30" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} /></label></div>{invite ? <div className="invite-result"><span>{invite.revokedAt ? "Revoked invite" : "Invite link"}</span><strong>{communityInviteService.getInviteLink(invite.code)}</strong><small>{invite.uses} / {invite.maxUses ?? "unlimited"} uses</small><div className="invite-result-actions"><button type="button" disabled={Boolean(invite.revokedAt)} onClick={() => void copy()}><AppIcon name="paperclip" size="sm" /> Copy link</button><button className="danger-action" type="button" disabled={Boolean(invite.revokedAt) || busy} onClick={() => void revoke()}><AppIcon name="trash" size="sm" /> Revoke</button></div></div> : null}{campaigns.length ? <div className="session-list" aria-label="Invite campaign summaries">{campaigns.slice(0, 6).map((campaign) => <article key={campaign.id} className="session-card"><div><strong>{campaign.campaignLabel ?? "Community invite"}</strong><small>{campaign.uses} / {campaign.maxUses ?? "unlimited"} uses - by {campaign.creatorName} - {campaign.revokedAt ? "revoked" : campaign.expiresAt && Date.parse(campaign.expiresAt) <= Date.now() ? "expired" : "active"}</small></div></article>)}</div> : null}{message ? <p className="invite-flow-message" role="status">{message}</p> : null}<div className="modal-actions-row"><button className="secondary-action" type="button" onClick={onClose}>Close</button><button className="send-button" type="button" disabled={!canCreate || busy} onClick={() => void create()}><AppIcon name="plus" size="sm" />{busy ? "Creating…" : "Create invite"}</button></div></div></InviteModalShell>;
}

export function JoinWithInviteModal({ initialCode = "", isAuthenticated, communities, currentUser, onClose, onAccepted }: { initialCode?: string; isAuthenticated: boolean; communities: Community[]; currentUser: Member; onClose: () => void; onAccepted: (communityId: string, member: Member) => void }) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true); setError(null);
    const result = await communityInviteService.acceptInvite({ code, communities, currentUser, isAuthenticated });
    if (!result.ok) { setError(result.error.message); setBusy(false); return; }
    onAccepted(result.data.communityId, result.data.member); onClose();
  };
  return <InviteModalShell title="Join with invite" onClose={onClose}><div className="invite-flow-content"><p>Paste a Picom invite code or link. Invalid, expired, revoked, and exhausted invites are rejected safely.</p><label className="invite-code-field"><span>Invite code or link</span><input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="picom://invite/..." /></label>{!isAuthenticated ? <p className="auth-error">Sign in or register before accepting an invite.</p> : null}{error ? <p className="auth-error" role="alert">{error}</p> : null}<div className="modal-actions-row"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="send-button" type="button" disabled={!isAuthenticated || busy || !code.trim()} onClick={() => void accept()}><AppIcon name="plus" size="sm" />{busy ? "Joining…" : "Accept invite"}</button></div></div></InviteModalShell>;
}
