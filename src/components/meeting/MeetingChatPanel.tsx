import { useEffect, useRef, useState } from "react";
import { meetingChatContextService, type MeetingChatMessage } from "../../services/meeting/meetingChatContextService";
import { fileService, type LocalAttachmentPreview } from "../../services/fileService";
import type { Attachment } from "../../types/community";
import type { MeetingChatContext } from "../../types/meetingChat";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { ImagePreviewModal } from "../ImagePreviewModal";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import "./MeetingChatPanel.css";

const reactionOptions = ["👍", "❤️", "😂", "🔥", "🎉"] as const;
const safeUrlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function SafeMessageBody({ body }: { body: string }) {
  return <p>{body.split(safeUrlPattern).map((part, index) => {
    if (!part.match(safeUrlPattern)) return <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>;
    const href = part.startsWith("www.") ? `https://${part}` : part;
    try {
      const url = new URL(href);
      if (!(["http:", "https:"] as string[]).includes(url.protocol)) return <span key={`${index}-${part}`}>{part}</span>;
      return <a key={`${index}-${part}`} href={url.toString()} target="_blank" rel="noopener noreferrer">{part}</a>;
    } catch {
      return <span key={`${index}-${part}`}>{part}</span>;
    }
  })}</p>;
}

type ChatMessageProps = Readonly<{
  message: MeetingChatMessage;
  participant?: MeetingClientParticipant;
  own: boolean;
  canWrite: boolean;
  canModerate: boolean;
  editing: boolean;
  editBody: string;
  confirmingDelete: boolean;
  reactionOpen: boolean;
  resolveAttachment: (attachment: Attachment) => Attachment;
  onPreview: (attachment: Attachment) => void;
  onReply: () => void;
  onEditStart: () => void;
  onEditBody: (body: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
  onToggleReactionMenu: () => void;
  onReaction: (emoji: string, reacted: boolean) => void;
  onReport: () => void;
  onCopyLink: () => void;
}>;

function ChatMessage(props: ChatMessageProps) {
  const { message, participant } = props;
  const name = participant?.displayName ?? (props.own ? "You" : "Picom member");
  return <article className={`meeting-chat-message${props.own ? " is-own" : ""}`} id={`meeting-chat-message-${message.id}`}>
    <VerifiedAvatarFrame userId={participant?.userId} label={name} avatarUrl={participant?.avatarUrl} avatarSeed={participant?.identity ?? message.authorId} verification={participant?.verification} size="compact" avatarSize={30} />
    <div className="meeting-chat-message__content">
      <header><strong>{name}</strong><VerifiedBadge verification={participant?.verification} size="xs" /><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></header>
      {message.replyPreview ? <button type="button" className="meeting-chat-reply-preview" onClick={() => document.getElementById(`meeting-chat-message-${message.replyPreview?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><AppIcon name="reply" size="xs" /><span><strong>{message.replyPreview.deleted ? "Deleted message" : "Reply"}</strong><small>{message.replyPreview.deleted ? "Original message is unavailable." : message.replyPreview.body}</small></span></button> : null}
      {props.editing ? <div className="meeting-chat-edit"><textarea rows={2} value={props.editBody} maxLength={4000} aria-label="Edit meeting message" onChange={(event) => props.onEditBody(event.target.value)} /><span><button type="button" onClick={props.onEditCancel}>Cancel</button><button type="button" disabled={!props.editBody.trim()} onClick={props.onEditSave}>Save</button></span></div> : <SafeMessageBody body={message.deletedAt ? "Message deleted" : message.body} />}
      {message.attachments.length ? <div className={`meeting-chat-attachments count-${Math.min(4, message.attachments.length)}`}>{message.attachments.slice(0, 4).map((item) => { const attachment = props.resolveAttachment(item); return <button type="button" key={item.id} disabled={!attachment.url} aria-label={`Preview ${attachment.alt}`} onClick={() => props.onPreview(attachment)}>{attachment.url ? <img src={attachment.thumbnailUrl || attachment.url} alt={attachment.alt} loading="lazy" /> : <span><AppIcon name="image" size="md" />Image processing</span>}</button>; })}</div> : null}
      {message.reactions?.length ? <div className="meeting-chat-reactions">{message.reactions.map((reaction) => <button type="button" key={reaction.emoji} className={reaction.reactedByCurrentUser ? "active" : ""} disabled={!props.canWrite || Boolean(message.deletedAt)} aria-pressed={reaction.reactedByCurrentUser} onClick={() => props.onReaction(reaction.emoji, Boolean(reaction.reactedByCurrentUser))}><span aria-hidden="true">{reaction.emoji}</span>{reaction.count}</button>)}</div> : null}
      <div className="meeting-chat-message__meta">{message.editedAt ? <small>Edited</small> : null}<div className="meeting-chat-message__actions">
        <button type="button" aria-label="Reply to meeting message" disabled={!props.canWrite || Boolean(message.deletedAt)} onClick={props.onReply}><AppIcon name="reply" size="xs" /></button>
        <button type="button" aria-label="React to meeting message" aria-expanded={props.reactionOpen} disabled={!props.canWrite || Boolean(message.deletedAt)} onClick={props.onToggleReactionMenu}><AppIcon name="smile" size="xs" /></button>
        {props.own && !message.deletedAt ? <button type="button" aria-label="Edit meeting message" onClick={props.onEditStart}><AppIcon name="edit" size="xs" /></button> : null}
        {(props.own || props.canModerate) && !message.deletedAt ? <button type="button" className={props.confirmingDelete ? "danger" : ""} aria-label={props.confirmingDelete ? "Confirm delete meeting message" : "Delete meeting message"} onClick={props.onDelete}><AppIcon name="trash" size="xs" /></button> : null}
        {!props.own ? <button type="button" aria-label="Report meeting message" onClick={props.onReport}><AppIcon name="more" size="xs" /></button> : null}
        <button type="button" aria-label="Copy meeting message link" onClick={props.onCopyLink}><AppIcon name="paperclip" size="xs" /></button>
      </div></div>
      {props.reactionOpen ? <div className="meeting-chat-reaction-picker" role="menu" aria-label="Choose a reaction">{reactionOptions.map((emoji) => <button type="button" role="menuitem" key={emoji} onClick={() => props.onReaction(emoji, Boolean(message.reactions?.find((item) => item.emoji === emoji)?.reactedByCurrentUser))}>{emoji}</button>)}</div> : null}
    </div>
  </article>;
}

export function MeetingChatPanel({ snapshot }: { snapshot: MeetingClientSnapshot }) {
  const [context, setContext] = useState<MeetingChatContext | null>(null);
  const [messages, setMessages] = useState<readonly MeetingChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [drafts, setDrafts] = useState<readonly LocalAttachmentPreview[]>([]);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const uploadAbort = useRef<AbortController | null>(null);
  const localPreviews = useRef(new Map<string, LocalAttachmentPreview>());
  const draftPreviews = useRef<readonly LocalAttachmentPreview[]>([]);
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  const canWrite = Boolean(context?.canWrite && snapshot.capabilities.canSendChat && ["connected", "reconnecting"].includes(snapshot.phase));
  draftPreviews.current = drafts;

  const resolveAttachment = (attachment: Attachment): Attachment => {
    const local = localPreviews.current.get(attachment.id);
    return local && !attachment.url ? { ...attachment, url: local.url, thumbnailUrl: local.url } : attachment;
  };
  const load = async (target: MeetingChatContext, expectedGeneration = generation.current) => {
    const result = await meetingChatContextService.listMessages(target, { limit: 60 });
    if (expectedGeneration !== generation.current) return;
    if (result.ok) {
      setMessages(result.data.items);
      const last = result.data.items[result.data.items.length - 1]?.id ?? null;
      void meetingChatContextService.markRead(target, last);
    } else setError(result.error.message);
    setLoading(false);
  };

  useEffect(() => { void meetingChatContextService.getActorId().then(setActorId); }, []);
  useEffect(() => {
    const expectedGeneration = ++generation.current;
    let cleanup: () => void = () => undefined;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    setLoading(true); setError(""); setNotice(""); setContext(null); setMessages([]);
    if (!snapshot.context) { setLoading(false); return; }
    void meetingChatContextService.resolveForMeeting(snapshot.context).then((result) => {
      if (cancelled || expectedGeneration !== generation.current) return;
      if (!result.ok) { setError(result.error.message); setLoading(false); return; }
      setContext(result.data); void load(result.data, expectedGeneration);
      cleanup = meetingChatContextService.subscribeMessages(result.data, () => void load(result.data, expectedGeneration), setRealtimeStatus);
      timer = setInterval(() => void load(result.data, expectedGeneration), 15_000);
    });
    return () => { cancelled = true; generation.current += 1; cleanup(); if (timer) clearInterval(timer); uploadAbort.current?.abort(); };
  }, [snapshot.context?.roomId, snapshot.context?.sessionId]);
  useEffect(() => () => { draftPreviews.current.forEach(fileService.revoke); localPreviews.current.forEach(fileService.revoke); localPreviews.current.clear(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const pickAttachments = async () => {
    if (!canWrite || drafts.length >= 4) return;
    const result = await fileService.pickImages();
    if (!result.ok) { setError(result.reason); return; }
    if (result.canceled) return;
    const next = result.files.slice(0, 4 - drafts.length).map(fileService.createPreview);
    setDrafts((current) => [...current, ...next]);
  };
  const removeDraft = (id: string) => setDrafts((current) => current.filter((item) => { if (item.id === id) fileService.revoke(item); return item.id !== id; }));
  const send = async () => {
    if (!context || sending || (!body.trim() && !drafts.length) || !canWrite) return;
    setSending(true); setError(""); setNotice("");
    const controller = new AbortController(); uploadAbort.current = controller;
    const uploaded = drafts.length ? await meetingChatContextService.uploadAttachments(context, drafts.map((item) => item.file), controller.signal) : { ok: true as const, data: [] };
    if (!uploaded.ok) { setError(uploaded.error.message); setSending(false); uploadAbort.current = null; return; }
    uploaded.data.forEach((metadata, index) => { const local = drafts[index]; if (local) localPreviews.current.set(metadata.id, local); });
    while (localPreviews.current.size > 40) { const oldest = localPreviews.current.entries().next().value as [string, LocalAttachmentPreview] | undefined; if (!oldest) break; fileService.revoke(oldest[1]); localPreviews.current.delete(oldest[0]); }
    const result = await meetingChatContextService.sendMessage({ context, body: body.trim() || "Shared an image", clientMessageId: crypto.randomUUID(), replyToMessageId: replyToId, attachmentIds: uploaded.data.map((item) => item.id) });
    if (result.ok) { setBody(""); setDrafts([]); setReplyToId(null); await load(context); }
    else setError(result.error.message);
    setSending(false); uploadAbort.current = null;
  };
  const saveEdit = async () => { if (!editingId || !editBody.trim()) return; const result = await meetingChatContextService.editMessage({ messageId: editingId, body: editBody.trim(), expectedEditedAt: messages.find((item) => item.id === editingId)?.editedAt }); if (result.ok && context) { setEditingId(null); await load(context); } else if (!result.ok) setError(result.error.message); };
  const removeMessage = async (message: MeetingChatMessage) => { if (confirmDeleteId !== message.id) { setConfirmDeleteId(message.id); return; } const result = await meetingChatContextService.deleteMessage({ messageId: message.id, expectedEditedAt: message.editedAt }); setConfirmDeleteId(null); if (result.ok && context) await load(context); else if (!result.ok) setError(result.error.message); };
  const react = async (message: MeetingChatMessage, emoji: string, reacted: boolean) => { const result = reacted ? await meetingChatContextService.removeReaction({ messageId: message.id, emoji }) : await meetingChatContextService.addReaction({ messageId: message.id, emoji }); setReactionTargetId(null); if (result.ok && context) await load(context); else if (!result.ok) setError(result.error.message); };
  const report = async (message: MeetingChatMessage) => { if (!context || !actorId) { setError("Your signed-in profile is required to report a message."); return; } const result = await meetingChatContextService.reportMessage(context, { reporterId: actorId, targetId: message.id, reason: "other", description: "Reported from meeting chat.", evidenceExcerpt: message.body.slice(0, 500) }); setNotice(result.ok ? "Report submitted to community moderation." : result.message); };
  const copyLink = async (messageId?: string) => { if (!context) return; const result = await meetingChatContextService.copyDeepLink({ communityId: context.communityId, channelId: context.channelId, roomId: context.roomId, sessionId: context.sessionId, messageId }); setNotice(result.ok ? "Meeting chat link copied." : result.error.message); };
  const openSource = () => { if (!context) return; const result = meetingChatContextService.openDeepLink({ communityId: context.communityId, channelId: context.channelId, roomId: context.roomId, sessionId: context.sessionId }); if (!result.ok) setError(result.error.message); };
  const reply = messages.find((item) => item.id === replyToId);

  return <section className="meeting-chat-panel meeting-chat-panel-v2" aria-label="Meeting chat">
    <header className="meeting-chat-context"><div><small>{context?.isGuest ? "Guest meeting chat" : context?.contextKind.replace(/_/g, " ") ?? "Meeting chat"}</small><strong>{context?.title ?? snapshot.context?.roomTitle ?? "Meeting chat"}</strong><span>{context?.preserveAfterMeeting ? "History remains in its Picom source after the meeting." : "Available during this meeting session."}</span></div><div><i className={`is-${realtimeStatus}`} aria-hidden="true" /><button type="button" aria-label="Open meeting chat source" disabled={!context} onClick={openSource}><AppIcon name="hash" size="xs" /></button><button type="button" aria-label="Copy meeting chat link" disabled={!context} onClick={() => void copyLink()}><AppIcon name="paperclip" size="xs" /></button></div></header>
    {error ? <p className="meeting-dock-error" role="alert">{error}</p> : null}{notice ? <p className="meeting-chat-notice" role="status">{notice}</p> : null}
    <div className="meeting-chat-list" aria-live="polite">{loading ? <div className="meeting-dock-empty"><strong>Loading meeting chat</strong></div> : messages.length ? messages.map((message) => <ChatMessage key={message.id} message={message} participant={participants.find((item) => item.userId === message.authorId)} own={actorId === message.authorId} canWrite={canWrite} canModerate={snapshot.capabilities.canManageParticipants} editing={editingId === message.id} editBody={editBody} confirmingDelete={confirmDeleteId === message.id} reactionOpen={reactionTargetId === message.id} resolveAttachment={resolveAttachment} onPreview={setPreview} onReply={() => setReplyToId(message.id)} onEditStart={() => { setEditingId(message.id); setEditBody(message.body); }} onEditBody={setEditBody} onEditSave={() => void saveEdit()} onEditCancel={() => setEditingId(null)} onDelete={() => void removeMessage(message)} onToggleReactionMenu={() => setReactionTargetId((current) => current === message.id ? null : message.id)} onReaction={(emoji, reacted) => void react(message, emoji, reacted)} onReport={() => void report(message)} onCopyLink={() => void copyLink(message.id)} />) : <div className="meeting-dock-empty"><AppIcon name="inbox" size="lg" /><strong>No meeting messages yet</strong><span>Start the durable linked conversation.</span></div>}<div ref={bottom} /></div>
    <footer className="meeting-chat-composer">{reply ? <div className="meeting-chat-compose-context"><AppIcon name="reply" size="xs" /><span><strong>Replying</strong><small>{reply.body}</small></span><button type="button" aria-label="Cancel meeting chat reply" onClick={() => setReplyToId(null)}><AppIcon name="close" size="xs" /></button></div> : null}{drafts.length ? <div className="meeting-chat-drafts">{drafts.map((draft) => <figure key={draft.id}><img src={draft.url} alt={draft.name} /><button type="button" aria-label={`Remove ${draft.name}`} onClick={() => removeDraft(draft.id)}><AppIcon name="close" size="xs" /></button></figure>)}</div> : null}<div className="meeting-chat-compose-row"><button type="button" aria-label="Attach images to meeting message" disabled={!canWrite || sending || drafts.length >= 4} onClick={() => void pickAttachments()}><AppIcon name="paperclip" size="sm" /></button><textarea rows={2} value={body} maxLength={4000} disabled={!canWrite || sending} placeholder={canWrite ? `Message ${context?.title ?? "meeting chat"}` : context?.isGuest ? "Guest chat access is read only" : "Meeting chat is read only"} aria-label="Meeting chat message" onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><button type="button" className="meeting-chat-send" disabled={(!body.trim() && !drafts.length) || sending || !canWrite} aria-label="Send meeting chat message" onClick={() => void send()}><AppIcon name="send" size="sm" /></button></div><small>{sending ? "Sending securely..." : canWrite ? "Enter to send, Shift+Enter for a new line" : "Your current meeting role cannot post here."}</small></footer>
    {preview ? <ImagePreviewModal image={preview} onClose={() => setPreview(null)} /> : null}
  </section>;
}
