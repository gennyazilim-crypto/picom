import { useEffect, useState, type FormEvent } from "react";
import type { DirectConversation } from "../types/directMessages";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";

type DirectMessagesViewProps = {
  conversations: DirectConversation[];
  activeConversationId: string;
  currentUserId: string;
  onSelectConversation: (conversationId: string) => void;
  onBackToCommunity: () => void;
  onOpenProfile: (userId: string) => void;
  onSendMessage: (conversationId: string, body: string) => void;
};

type ConversationProps = Pick<DirectMessagesViewProps, "conversations" | "activeConversationId" | "onSelectConversation">;

export function DirectConversationList({ conversations, activeConversationId, onSelectConversation }: ConversationProps) {
  if (!conversations.length) {
    return <div className="direct-list-empty"><strong>Start a direct message</strong><span>Open a profile and choose Message.</span></div>;
  }

  return (
    <div className="direct-conversation-list" aria-label="Recent direct conversations">
      {conversations.map((conversation) => (
        <button key={conversation.id} className={`direct-conversation ${conversation.id === activeConversationId ? "active" : ""}`} onClick={() => onSelectConversation(conversation.id)}>
          <span className={`direct-avatar status-${conversation.participantStatus}`}>{conversation.participantName.slice(0, 1)}</span>
          <span className="direct-copy"><strong>{conversation.participantName}</strong><small>{conversation.lastMessagePreview || "Start a conversation"}</small></span>
          {conversation.unreadCount ? <em aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function DirectMessagesSidebar(props: ConversationProps) {
  return (
    <aside className="direct-list">
      <header className="direct-list-header"><span className="eyebrow">Messages</span><h2>Direct messages</h2><p>Private conversations available only to their participants.</p></header>
      <DirectConversationList {...props} />
    </aside>
  );
}

export function DirectConversationHeader({ conversation, onBack, onOpenProfile }: { conversation: DirectConversation; onBack: () => void; onOpenProfile: (userId: string) => void }) {
  return (
    <header className="direct-chat-header">
      <button className="icon-button" aria-label="Back to community chat" onClick={onBack}><AppIcon name="chevronRight" size="sm" /></button>
      <button className="direct-chat-identity" onClick={() => onOpenProfile(conversation.participantUserId)}>
        <span className={`direct-avatar status-${conversation.participantStatus}`}>{conversation.participantName.slice(0, 1)}</span>
        <span><strong>{conversation.participantName}</strong><small>@{conversation.participantUsername} · {conversation.participantStatusText}</small></span>
      </button>
    </header>
  );
}

function DirectMessageComposer({ conversationId, onSendMessage }: { conversationId: string; onSendMessage: (conversationId: string, body: string) => void }) {
  const [body, setBody] = useState("");
  useEffect(() => setBody(""), [conversationId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    onSendMessage(conversationId, value);
    setBody("");
  };

  return (
    <form className="direct-composer" onSubmit={submit}>
      <button type="button" aria-label="Attach file" disabled><AppIcon name="paperclip" size="sm" /></button>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message privately" rows={1} maxLength={4000} />
      <button type="submit" className="direct-send" aria-label="Send direct message" disabled={!body.trim()}><AppIcon name="send" size="sm" /></button>
    </form>
  );
}

export function DirectChatMain({ conversation, currentUserId, onBack, onOpenProfile, onSendMessage }: { conversation?: DirectConversation; currentUserId: string; onBack: () => void; onOpenProfile: (userId: string) => void; onSendMessage: (conversationId: string, body: string) => void }) {
  if (!conversation) {
    return <main className="direct-chat-panel"><div className="empty-state"><AppIcon name="inbox" size="xl" /><strong>Select a conversation</strong><p>Choose a recent conversation or start a direct message from a profile.</p></div></main>;
  }

  return (
    <main className="direct-chat-panel">
      <DirectConversationHeader conversation={conversation} onBack={onBack} onOpenProfile={onOpenProfile} />
      <div className="direct-message-list" aria-live="polite">
        {conversation.messages.length ? conversation.messages.map((message) => {
          const own = message.authorId === currentUserId;
          return <article key={message.id} className={`direct-message ${own ? "own" : ""}`}><span>{message.body}</span><small>{dateTimeService.formatMessageTime(message.createdAt)}</small></article>;
        }) : <div className="direct-chat-empty"><strong>Start a direct message</strong><span>Messages here are visible only to conversation members.</span></div>}
      </div>
      <DirectMessageComposer conversationId={conversation.id} onSendMessage={onSendMessage} />
    </main>
  );
}

export function DirectMessagesView({ conversations, activeConversationId, currentUserId, onSelectConversation, onBackToCommunity, onOpenProfile, onSendMessage }: DirectMessagesViewProps) {
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  return (
    <section className="direct-messages-view" aria-label="Direct messages">
      <DirectMessagesSidebar conversations={conversations} activeConversationId={activeConversationId} onSelectConversation={onSelectConversation} />
      <DirectChatMain conversation={activeConversation} currentUserId={currentUserId} onBack={onBackToCommunity} onOpenProfile={onOpenProfile} onSendMessage={onSendMessage} />
    </section>
  );
}

