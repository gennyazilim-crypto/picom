import { useEffect, useMemo, useState } from "react";
import { botCredentialService } from "../services/botCredentialService";
import { botService } from "../services/botService";
import { featureFlagService } from "../services/featureFlagService";
import { webhookService } from "../services/webhookService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import type { WebhookRecord } from "../types/webhooks";
import { AppIcon, type IconName } from "./AppIcon";

type DeveloperPortalSection = "bots" | "webhooks" | "applications" | "docs";

type DeveloperPortalViewProps = Readonly<{
  communityId: string;
  communityName: string;
  ownerId: string;
  canManageBots: boolean;
  canManageWebhooks: boolean;
  onClose: () => void;
  onNotice: (message: string, tone?: "info" | "success" | "error") => void;
}>;

const sections: Array<{ id: DeveloperPortalSection; label: string; icon: IconName }> = [
  { id: "bots", label: "My Bots", icon: "user" },
  { id: "webhooks", label: "Webhooks", icon: "send" },
  { id: "applications", label: "Applications", icon: "settings" },
  { id: "docs", label: "API Docs", icon: "inbox" },
];

export function DeveloperPortalView({ communityId, communityName, ownerId, canManageBots, canManageWebhooks, onClose, onNotice }: DeveloperPortalViewProps) {
  const [active, setActive] = useState<DeveloperPortalSection>("bots");
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const enabled = featureFlagService.isEnabled("enableDeveloperPortal");
  const permitted = canManageBots || canManageWebhooks;
  const bots = useMemo(() => canManageBots ? botService.listInstalledBots(communityId, ownerId) : [], [canManageBots, communityId, ownerId]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);

  useEffect(() => {
    if (!enabled || !canManageWebhooks) return;
    let activeRequest = true;
    setLoadingWebhooks(true);
    void webhookService.list(communityId).then((result) => {
      if (!activeRequest) return;
      setLoadingWebhooks(false);
      if (result.ok) setWebhooks(result.data);
      else onNotice(result.message, "error");
    });
    return () => { activeRequest = false; };
  }, [canManageWebhooks, communityId, enabled, onNotice]);

  if (!enabled || !permitted) return null;

  const content = active === "bots"
    ? <div className="placeholder-panel action-panel"><strong>My Bots</strong><p>Bot identities installed in {communityName}. Credentials are represented by prefix/status only; raw tokens and token hashes are never shown here.</p><div className="admin-ops-metrics">{bots.length ? bots.map((bot) => { const credential = botCredentialService.getStatus(bot.id); return <article key={bot.id}><span>{bot.displayName}</span><strong>{credential.configured ? (credential.revokedAt ? "Revoked" : `Active ${credential.tokenPrefix}`) : "No credential"}</strong><small>Role: {bot.roleId}</small></article>; }) : <article><span>Bot access</span><strong>{canManageBots ? "No bots installed" : "Not permitted"}</strong></article>}</div><small>Create, revoke, and assign role permissions from the active community's Bots settings. No executable runtime or marketplace is available.</small></div>
    : active === "webhooks"
      ? <div className="placeholder-panel action-panel"><strong>Webhooks</strong><p>Safe webhook metadata for {communityName}. One-time URLs, raw tokens, and token hashes are intentionally excluded.</p><div className="admin-ops-metrics">{loadingWebhooks ? <article><span>Status</span><strong>Loading metadata</strong></article> : webhooks.length ? webhooks.map((webhook) => <article key={webhook.id}><span>{webhook.name}</span><strong>{webhook.revokedAt ? "Revoked" : "Active"}</strong><small>Channel integration</small></article>) : <article><span>Webhook access</span><strong>{canManageWebhooks ? "No webhooks configured" : "Not permitted"}</strong></article>}</div><small>Create and revoke webhooks from the active community's Webhooks settings. Production delivery remains controlled by server configuration and role enforcement.</small></div>
      : active === "applications"
        ? <div className="placeholder-panel action-panel"><strong>Applications placeholder</strong><p>Public application registration, publishing, review, OAuth clients, marketplace listing, and API key issuance are not enabled.</p><div className="settings-status-card"><span>Publishing</span><strong>Disabled</strong><small>Future applications require owner verification, scopes, signing/review, rate limits, audit logs, and abuse controls.</small></div></div>
        : <div className="placeholder-panel action-panel"><strong>Developer documentation</strong><p>Restricted beta architecture guidance covers role-scoped bots and incoming webhooks. No public API base URL or production developer credential is exposed.</p><div className="settings-status-card"><span>Bot API</span><strong>Foundation only</strong><small>One-time credentials, role permissions, server verification, and rate limits must be production-certified.</small></div><div className="settings-status-card"><span>Webhook API</span><strong>Server-gated foundation</strong><small>Use one-time URLs securely; delivery requires explicit protected backend enablement.</small></div></div>;

  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="developer-portal-title" onMouseDown={(event) => event.stopPropagation()}><aside className="settings-nav"><p className="eyebrow">Restricted beta</p><h2 id="developer-portal-title">Developer Portal</h2><div className="settings-tabs">{sections.map((section) => <button type="button" key={section.id} className={active === section.id ? "active" : ""} onClick={() => setActive(section.id)}><AppIcon name={section.icon} size="sm" />{section.label}</button>)}</div></aside><main className="settings-content"><button type="button" className="icon-button modal-close" aria-label="Close Developer Portal" onClick={onClose}><AppIcon name="close" size="lg" /></button><p className="eyebrow">Beta / permission restricted</p><h2>{sections.find((section) => section.id === active)?.label}</h2>{content}</main></section></div>;
}
