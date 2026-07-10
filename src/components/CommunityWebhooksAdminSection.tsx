import { useEffect, useState } from "react";
import type { Community } from "../types/community";
import type { CreatedWebhook, WebhookRecord } from "../types/webhooks";
import { clipboardService } from "../services/clipboardService";
import { webhookService } from "../services/webhookService";
import { AppIcon } from "./AppIcon";

export function CommunityWebhooksAdminSection({ community, currentUserId, canManage }: { community: Community; currentUserId: string; canManage: boolean }) {
  const channels = community.categories.flatMap((category) => category.channels).filter((channel) => channel.type === "text");
  const [items, setItems] = useState<WebhookRecord[]>([]);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [credential, setCredential] = useState<Pick<CreatedWebhook, "endpointUrl" | "tokenOnce"> | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<WebhookRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true; setCredential(null);
    void webhookService.list(community.id).then((result) => { if (!active) return; if (result.ok) setItems(result.data); else setNotice(result.message); });
    return () => { active = false; };
  }, [community.id]);

  const create = async () => {
    const result = await webhookService.create({ communityId: community.id, channelId, name, createdBy: currentUserId, canManage });
    if (!result.ok) { setNotice(result.message); return; }
    setItems((current) => [result.data.webhook, ...current]); setCredential({ endpointUrl: result.data.endpointUrl, tokenOnce: result.data.tokenOnce }); setName(""); setNotice("Webhook created. Copy the endpoint and token now; the token will not be shown again.");
  };
  const copyValue = async (value: string, label: string) => { const result = await clipboardService.copyText(value); setNotice(result.ok ? `${label} copied.` : result.reason); };
  const revoke = async () => { if (!pendingRevoke) return; const result = await webhookService.revoke(pendingRevoke, canManage); if (result.ok) { setItems((current) => current.map((item) => item.id === result.data.id ? result.data : item)); setPendingRevoke(null); setNotice("Webhook revoked."); } else setNotice(result.message); };

  return <section className="community-admin-section webhooks-admin-section"><header><p className="eyebrow">Channel integrations</p><h3>Webhooks</h3><span>Role-scoped plain-text delivery only. Tokens use a one-time header credential; no query-string secret, embed, attachment, executable payload, or unsafe HTML is accepted.</span></header><div className="webhook-create-form"><label><span>Name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Release Updates" /></label><label><span>Channel</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label><button type="button" disabled={!canManage || !name.trim() || !channelId} onClick={() => void create()}><AppIcon name="plus" size="sm" />Create webhook</button></div>{credential ? <div className="webhook-secret-once" role="status"><div><strong>One-time webhook credential</strong><span>{credential.endpointUrl}</span><code style={{ overflowWrap: "anywhere" }}>{credential.tokenOnce}</code><small>Send the token only in the X-Picom-Webhook-Token header. Picom stores only its hash.</small></div><div className="settings-actions-row"><button type="button" onClick={() => void copyValue(credential.endpointUrl, "Endpoint")}><AppIcon name="paperclip" size="sm" />Copy endpoint</button><button type="button" onClick={() => void copyValue(credential.tokenOnce, "One-time token")}><AppIcon name="lock" size="sm" />Copy token</button><button type="button" className="secondary-action" onClick={() => setCredential(null)}><AppIcon name="close" size="sm" />Dismiss</button></div></div> : null}{notice ? <p className="webhook-admin-notice" role="status">{notice}</p> : null}<div className="webhook-list">{items.map((webhook) => <article key={webhook.id}><div><strong>{webhook.name}{webhook.revokedAt ? <span>Revoked</span> : null}</strong><small>#{channels.find((channel) => channel.id === webhook.channelId)?.name ?? webhook.channelId}</small></div><button className="danger-action" type="button" disabled={!canManage || Boolean(webhook.revokedAt)} onClick={() => setPendingRevoke(webhook)}><AppIcon name="trash" size="sm" />Revoke</button></article>)}</div>{pendingRevoke ? <div className="webhook-revoke-confirm" role="alertdialog" aria-label="Confirm webhook revocation"><div><strong>Revoke {pendingRevoke.name}?</strong><span>The one-time token will stop working permanently.</span></div><button className="secondary-action" type="button" onClick={() => setPendingRevoke(null)}>Cancel</button><button className="danger-action" type="button" onClick={() => void revoke()}>Confirm revoke</button></div> : null}</section>;
}
