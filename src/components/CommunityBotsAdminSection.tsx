import { useMemo, useState } from "react";
import { botService } from "../services/botService";
import { botCredentialService } from "../services/botCredentialService";
import { clipboardService } from "../services/clipboardService";
import type { BotCredentialStatus, BotProfile, IssuedBotToken } from "../types/bots";
import { AppIcon } from "./AppIcon";
import "./CommunityBotsAdminSection.css";

function getStatuses(bots: readonly BotProfile[]): Record<string, BotCredentialStatus> {
  return Object.fromEntries(bots.map((bot) => [bot.id, botCredentialService.getStatus(bot.id)]));
}

function credentialLabel(credential: BotCredentialStatus): string {
  if (!credential.configured) return "Not issued";
  if (credential.revokedAt) return "Revoked";
  return `Active ${credential.tokenPrefix ?? ""}`.trim();
}

function credentialTone(credential: BotCredentialStatus): "none" | "active" | "revoked" {
  if (!credential.configured) return "none";
  if (credential.revokedAt) return "revoked";
  return "active";
}

export function CommunityBotsAdminSection({
  communityId,
  ownerId,
  canManage,
}: {
  communityId: string;
  ownerId: string;
  canManage: boolean;
}) {
  const [bots, setBots] = useState(() => botService.listInstalledBots(communityId, ownerId));
  const [statuses, setStatuses] = useState(() => getStatuses(bots));
  const [pendingRemoval, setPendingRemoval] = useState<BotProfile | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedBotToken | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  const counts = useMemo(() => {
    const values = bots.map((bot) => statuses[bot.id] ?? botCredentialService.getStatus(bot.id));
    return values.reduce(
      (summary, credential) => {
        if (!credential.configured) summary.unissued += 1;
        else if (credential.revokedAt) summary.revoked += 1;
        else summary.active += 1;
        return summary;
      },
      { active: 0, revoked: 0, unissued: 0 },
    );
  }, [bots, statuses]);

  const add = () => {
    const result = botService.addBotPlaceholder(communityId, ownerId, canManage);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    setBots((items) => [...items, result.data]);
    setStatuses((current) => ({ ...current, [result.data.id]: botCredentialService.getStatus(result.data.id) }));
    setNotice({ error: false, text: "Mock bot installed with the Member role." });
  };

  const issueToken = async (bot: BotProfile) => {
    const result = await botCredentialService.issueTokenOnce(bot.id, canManage);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    setIssuedToken(result.data);
    setStatuses((current) => ({ ...current, [bot.id]: botCredentialService.getStatus(bot.id) }));
    setNotice({
      error: false,
      text: "One-time mock token created. It is not stored or logged in raw form.",
    });
  };

  const copyIssuedToken = async () => {
    if (!issuedToken) return;
    const result = await clipboardService.copyText(issuedToken.rawToken);
    setNotice({
      error: !result.ok,
      text: result.ok ? "One-time token copied. Store it securely before dismissing." : result.reason,
    });
  };

  const revokeToken = (bot: BotProfile) => {
    const result = botCredentialService.revokeToken(bot.id, canManage);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    if (issuedToken?.botId === bot.id) setIssuedToken(null);
    setStatuses((current) => ({ ...current, [bot.id]: result.data }));
    setNotice({
      error: false,
      text: "Mock bot credential revoked. The raw token cannot be recovered.",
    });
  };

  const remove = () => {
    if (!pendingRemoval) return;
    const result = botService.removeBot(communityId, pendingRemoval.id, canManage);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    setBots((items) => items.filter((bot) => bot.id !== pendingRemoval.id));
    setNotice({ error: false, text: "Bot removed from this community." });
    setPendingRemoval(null);
  };

  return (
    <section className="community-admin-section community-bots-section">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Automation identities</p>
          <h3>Bots</h3>
          <p>
            Role-scoped identities only. No marketplace, executable plugin runtime, public endpoint, or
            unrestricted code execution.
          </p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true">
          <AppIcon name="user" size="md" />
        </span>
      </header>

      <div className="community-mgmt-card bots-summary-card">
        <div className="bots-summary-copy">
          <strong>{bots.length} installed</strong>
          <span>
            Bot permissions follow their assigned community role. Mock credentials are limited to 60 requests
            per minute.
          </span>
        </div>
        <button type="button" className="community-mgmt-action" disabled={!canManage} onClick={add}>
          <AppIcon name="plus" size="sm" />
          Add bot placeholder
        </button>
      </div>

      <div className="bots-summary-metrics" aria-label="Bot credential summary">
        <article className="bots-metric bots-metric--installed">
          <span className="bots-metric-icon" aria-hidden="true">
            <AppIcon name="user" size="sm" />
          </span>
          <strong>{bots.length}</strong>
          <span>Installed</span>
        </article>
        <article className="bots-metric bots-metric--active">
          <span className="bots-metric-icon" aria-hidden="true">
            <AppIcon name="lock" size="sm" />
          </span>
          <strong>{counts.active}</strong>
          <span>Active tokens</span>
        </article>
        <article className="bots-metric bots-metric--revoked">
          <span className="bots-metric-icon" aria-hidden="true">
            <AppIcon name="trash" size="sm" />
          </span>
          <strong>{counts.revoked + counts.unissued}</strong>
          <span>Revoked / unissued</span>
        </article>
      </div>

      {notice ? (
        <p
          className={notice.error ? "community-mgmt-notice is-error" : "community-mgmt-notice"}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {issuedToken ? (
        <div className="community-mgmt-subcard bots-token-banner" role="status">
          <div className="bots-token-copy">
            <strong>One-time bot token</strong>
            <span>Copy it now. Picom stores only its hash and cannot show this value again.</span>
            <code>{issuedToken.rawToken}</code>
          </div>
          <div className="bots-token-actions">
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => void copyIssuedToken()}>
              <AppIcon name="paperclip" size="sm" />
              Copy once
            </button>
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setIssuedToken(null)}>
              <AppIcon name="close" size="sm" />
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {bots.length ? (
        <div className="bots-admin-list">
          {bots.map((bot) => {
            const credential = statuses[bot.id] ?? botCredentialService.getStatus(bot.id);
            const tone = credentialTone(credential);

            return (
              <article key={bot.id} className="bots-admin-card">
                <span className="bots-avatar" aria-hidden="true">
                  <AppIcon name="user" size="md" />
                </span>

                <div className="bots-admin-copy">
                  <div className="bots-admin-title-row">
                    <strong>{bot.displayName}</strong>
                    <span className="community-mgmt-badge bots-role-badge">Bot</span>
                    <span className={`community-mgmt-badge bots-credential-badge bots-credential-badge--${tone}`}>
                      {credentialLabel(credential)}
                    </span>
                  </div>
                  <span>Role: {bot.roleId}</span>
                  <small>Rate limit: {credential.rateLimitPerMinute} requests / minute</small>
                </div>

                <div className="bots-admin-actions">
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost"
                    disabled={!canManage || credential.configured}
                    onClick={() => void issueToken(bot)}
                  >
                    Create token once
                  </button>
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost"
                    disabled={!canManage || !credential.configured || Boolean(credential.revokedAt)}
                    onClick={() => revokeToken(bot)}
                  >
                    Revoke
                  </button>
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger community-mgmt-action--icon"
                    aria-label={`Remove ${bot.displayName}`}
                    disabled={!canManage}
                    onClick={() => setPendingRemoval(bot)}
                  >
                    <AppIcon name="trash" size="sm" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="community-mgmt-empty bots-empty-state">
          <span className="bots-empty-icon" aria-hidden="true">
            <AppIcon name="user" size="lg" />
          </span>
          <strong>No bots installed</strong>
          <span>Add a role-scoped placeholder identity to test credential issuance and revocation.</span>
          <button type="button" className="community-mgmt-action" disabled={!canManage} onClick={add}>
            <AppIcon name="plus" size="sm" />
            Add bot placeholder
          </button>
        </div>
      )}

      {pendingRemoval ? (
        <div
          className="bot-remove-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bot-remove-title"
        >
          <span className="bot-remove-icon" aria-hidden="true">
            <AppIcon name="trash" size="lg" />
          </span>
          <div className="bot-remove-copy">
            <strong id="bot-remove-title">Remove {pendingRemoval.displayName}?</strong>
            <p>This removes the community installation only. Revoke its credential separately first.</p>
          </div>
          <footer className="community-mgmt-footer">
            <button
              type="button"
              className="community-mgmt-action community-mgmt-action--ghost"
              onClick={() => setPendingRemoval(null)}
            >
              Cancel
            </button>
            <button type="button" className="community-mgmt-action community-mgmt-action--danger" onClick={remove}>
              Confirm remove
            </button>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
