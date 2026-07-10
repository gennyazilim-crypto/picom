import { useState } from "react";
import { botService } from "../services/botService";
import { botCredentialService } from "../services/botCredentialService";
import { clipboardService } from "../services/clipboardService";
import type { BotCredentialStatus, BotProfile, IssuedBotToken } from "../types/bots";
import { AppIcon } from "./AppIcon";

function getStatuses(bots: readonly BotProfile[]): Record<string, BotCredentialStatus> {
  return Object.fromEntries(bots.map((bot) => [bot.id, botCredentialService.getStatus(bot.id)]));
}

export function CommunityBotsAdminSection({ communityId, ownerId, canManage }: { communityId: string; ownerId: string; canManage: boolean }) {
  const [bots, setBots] = useState(() => botService.listInstalledBots(communityId, ownerId));
  const [statuses, setStatuses] = useState(() => getStatuses(bots));
  const [pendingRemoval, setPendingRemoval] = useState<BotProfile | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedBotToken | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = () => {
    const result = botService.addBotPlaceholder(communityId, ownerId, canManage);
    if (!result.ok) return setNotice(result.message);
    setBots((items) => [...items, result.data]);
    setStatuses((current) => ({ ...current, [result.data.id]: botCredentialService.getStatus(result.data.id) }));
    setNotice("Mock bot installed with the Member role.");
  };

  const issueToken = async (bot: BotProfile) => {
    const result = await botCredentialService.issueTokenOnce(bot.id, canManage);
    if (!result.ok) return setNotice(result.message);
    setIssuedToken(result.data);
    setStatuses((current) => ({ ...current, [bot.id]: botCredentialService.getStatus(bot.id) }));
    setNotice("One-time mock token created. It is not stored or logged in raw form.");
  };

  const copyIssuedToken = async () => {
    if (!issuedToken) return;
    const result = await clipboardService.copyText(issuedToken.rawToken);
    setNotice(result.ok ? "One-time token copied. Store it securely before dismissing." : result.reason);
  };

  const revokeToken = (bot: BotProfile) => {
    const result = botCredentialService.revokeToken(bot.id, canManage);
    if (!result.ok) return setNotice(result.message);
    if (issuedToken?.botId === bot.id) setIssuedToken(null);
    setStatuses((current) => ({ ...current, [bot.id]: result.data }));
    setNotice("Mock bot credential revoked. The raw token cannot be recovered.");
  };

  const remove = () => {
    if (!pendingRemoval) return;
    const result = botService.removeBot(communityId, pendingRemoval.id, canManage);
    if (!result.ok) return setNotice(result.message);
    setBots((items) => items.filter((bot) => bot.id !== pendingRemoval.id));
    setNotice("Bot removed from this community.");
    setPendingRemoval(null);
  };

  return <section className="community-admin-section bots-admin-section"><header><p className="eyebrow">Automation identities</p><h3>Bots</h3><span>Role-scoped identities only. No marketplace, executable plugin runtime, public endpoint, or unrestricted code execution.</span></header><div className="bots-admin-toolbar"><div><strong>{bots.length} installed</strong><span>Bot permissions follow their assigned community role. Mock credentials are limited to 60 requests per minute.</span></div><button type="button" disabled={!canManage} onClick={add}><AppIcon name="plus" size="sm" />Add bot placeholder</button></div>{notice ? <p className="bots-admin-notice" role="status">{notice}</p> : null}{issuedToken ? <div className="bots-admin-toolbar" role="status"><div><strong>One-time bot token</strong><span>Copy it now. Picom stores only its hash and cannot show this value again.</span><code style={{ overflowWrap: "anywhere" }}>{issuedToken.rawToken}</code></div><div className="settings-actions-row"><button type="button" onClick={() => void copyIssuedToken()}><AppIcon name="paperclip" size="sm" />Copy once</button><button type="button" onClick={() => setIssuedToken(null)}><AppIcon name="close" size="sm" />Dismiss</button></div></div> : null}<div className="bots-admin-list">{bots.map((bot) => { const credential = statuses[bot.id] ?? botCredentialService.getStatus(bot.id); return <article key={bot.id}><span className="bots-avatar"><AppIcon name="user" size="md" /></span><div><strong>{bot.displayName}<span className="bot-badge">BOT</span></strong><span>Role: {bot.roleId} - Credential: {credential.configured ? (credential.revokedAt ? "revoked" : `active ${credential.tokenPrefix}`) : "not issued"}</span></div><div className="settings-actions-row"><button type="button" disabled={!canManage || credential.configured} onClick={() => void issueToken(bot)}>Create token once</button><button type="button" disabled={!canManage || !credential.configured || Boolean(credential.revokedAt)} onClick={() => revokeToken(bot)}>Revoke</button><button className="danger-action" type="button" disabled={!canManage} onClick={() => setPendingRemoval(bot)}><AppIcon name="trash" size="sm" />Remove</button></div></article>; })}</div>{pendingRemoval ? <div className="bot-remove-confirm" role="alertdialog" aria-label="Confirm bot removal"><div><strong>Remove {pendingRemoval.displayName}?</strong><span>This removes the community installation only. Revoke its credential separately first.</span></div><button className="secondary-action" type="button" onClick={() => setPendingRemoval(null)}>Cancel</button><button className="danger-action" type="button" onClick={remove}>Confirm remove</button></div> : null}</section>;
}

