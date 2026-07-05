import type { DirectConversation } from "../types/directMessages";
import { AppIcon } from "./AppIcon";

type DirectMessagesViewProps = {
  conversations: DirectConversation[];
  activeConversationId: string;
  currentUserId: string;
  onSelectConversation: (conversationId: string) => void;
  onBackToCommunity: () => void;
  onOpenProfile: (userId: string) => void;
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function DirectMessagesView({
  conversations,
  activeConversationId,
  currentUserId,
  onSelectConversation,
  onBackToCommunity,
  onOpenProfile,
}: DirectMessagesViewProps) {
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];

  return (
    <section className="direct-messages-view" aria-label="Direct messages placeholder">
      <aside className="direct-list">
        <header className="direct-list-header">
          <span className="eyebrow">Messages</span>
          <h2>Direct messages</h2>
          <p>Beta placeholder. Production DM backend and privacy controls are not enabled yet.</p>
        </header>
        <div className="direct-conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`direct-conversation ${conversation.id === activeConversation?.id ? "active" : ""}`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <span className={`direct-avatar status-${conversation.participantStatus}`}>
                {conversation.participantName.slice(0, 1)}
              </span>
              <span className="direct-copy">
                <strong>{conversation.participantName}</strong>
                <small>{conversation.lastMessagePreview}</small>
              </span>
              {conversation.unreadCount ? <em>{conversation.unreadCount}</em> : null}
            </button>
          ))}
        </div>
      </aside>
      <main className="direct-chat-panel">
        {activeConversation ? (
          <>
            <header className="direct-chat-header">
              <button className="icon-button" aria-label="Back to community chat" onClick={onBackToCommunity}>
                <AppIcon name="chevronRight" size="sm" />
              </button>
              <button className="direct-chat-identity" onClick={() => onOpenProfile(activeConversation.participantUserId)}>
                <span className={`direct-avatar status-${activeConversation.participantStatus}`}>
                  {activeConversation.participantName.slice(0, 1)}
                </span>
                <span>
                  <strong>{activeConversation.participantName}</strong>
                  <small>@{activeConversation.participantUsername} - {activeConversation.participantStatusText}</small>
                </span>
              </button>
            </header>
            <div className="direct-message-list">
              {activeConversation.messages.map((message) => {
                const own = message.authorId === currentUserId;

                return (
                  <article key={message.id} className={`direct-message ${own ? "own" : ""}`}>
                    <span>{message.body}</span>
                    <small>{message.isPlaceholder ? "Placeholder - " : ""}{formatTime(message.createdAt)}</small>
                  </article>
                );
              })}
            </div>
            <footer className="direct-composer-placeholder">
              <AppIcon name="lock" size="sm" />
              Direct message sending is paused until Supabase DM policies are ready.
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <strong>No direct conversations yet</strong>
            <p>Open a member context menu to preview the DM foundation.</p>
          </div>
        )}
      </main>
    </section>
  );
}
