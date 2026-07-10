import type { FriendConnection, FriendRequest, FriendSuggestion } from "../types/friends";
import { AppIcon } from "./AppIcon";

type FriendsViewProps = {
  friends: FriendConnection[];
  requests: FriendRequest[];
  suggestions: FriendSuggestion[];
  onBackToCommunity: () => void;
  onOpenDirectMessage: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onToggleFavorite: (userId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onDismissRequest: (requestId: string) => void;
  onCancelRequest: (requestId: string) => void;
  onSendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlockFriend: (userId: string) => void;
};

function FriendAvatar({ name, status }: { name: string; status?: string }) {
  return <span className={`friend-avatar status-${status ?? "offline"}`}>{name.slice(0, 1)}</span>;
}

export function FriendsView({
  friends,
  requests,
  suggestions,
  onBackToCommunity,
  onOpenDirectMessage,
  onOpenProfile,
  onToggleFavorite,
  onAcceptRequest,
  onDismissRequest,
  onCancelRequest,
  onSendRequest,
  onRemoveFriend,
  onBlockFriend,
}: FriendsViewProps) {
  const incomingRequests = requests.filter((request) => request.direction === "incoming");
  const outgoingRequests = requests.filter((request) => request.direction === "outgoing");

  return (
    <section className="friends-view" aria-label="Friends">
      <header className="friends-header">
        <button className="icon-button" aria-label="Back to community chat" onClick={onBackToCommunity}>
          <AppIcon name="chevronRight" size="sm" />
        </button>
        <div>
          <span className="eyebrow">People</span>
          <h2>Friends</h2>
          <p>Manage trusted connections, incoming requests, and privacy-aware suggestions.</p>
        </div>
      </header>

      <div className="friends-grid">
        <section className="friends-panel">
          <div className="friends-panel-title">
            <strong>Friends</strong>
            <span>{friends.length}</span>
          </div>
          <div className="friend-list">
            {friends.map((friend) => (
              <article key={friend.userId} className="friend-card">
                <FriendAvatar name={friend.displayName} status={friend.status} />
                <div className="friend-copy">
                  <strong>{friend.displayName}</strong>
                  <small>@{friend.username} - {friend.statusText}</small>
                  <span>{friend.mutualCommunityCount} shared communities</span>
                </div>
                <div className="friend-actions">
                  <button onClick={() => onOpenDirectMessage(friend.userId)}>Message</button>
                  <button onClick={() => onOpenProfile(friend.userId)}>Profile</button>
                  <button onClick={() => onToggleFavorite(friend.userId)}>{friend.favorite ? "Starred" : "Star"}</button>
                  <button onClick={() => onRemoveFriend(friend.userId)}>Remove</button>
                  <button className="danger-button" onClick={() => onBlockFriend(friend.userId)}>Block</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="friends-side-panel">
          <section className="friends-panel compact">
            <div className="friends-panel-title">
              <strong>Incoming requests</strong>
              <span>{incomingRequests.length}</span>
            </div>
            {incomingRequests.map((request) => (
              <article key={request.id} className="friend-request-card">
                <FriendAvatar name={request.displayName} />
                <div>
                  <strong>{request.displayName}</strong>
                  <small>@{request.username}</small>
                  <p>{request.note}</p>
                  <div className="friend-request-actions">
                    <button onClick={() => onAcceptRequest(request.id)}>Accept</button>
                    <button onClick={() => onDismissRequest(request.id)}>Dismiss</button>
                  </div>
                </div>
              </article>
            ))}
            {!incomingRequests.length ? <p className="friend-empty">No incoming requests.</p> : null}
          </section>

          <section className="friends-panel compact">
            <div className="friends-panel-title">
              <strong>Pending sent</strong>
              <span>{outgoingRequests.length}</span>
            </div>
            {outgoingRequests.map((request) => (
              <article key={request.id} className="friend-mini-row">
                <FriendAvatar name={request.displayName} />
                <span>
                  <strong>{request.displayName}</strong>
                  <small>@{request.username}</small>
                </span>
                <button onClick={() => onCancelRequest(request.id)}>Cancel</button>
              </article>
            ))}
            {!outgoingRequests.length ? <p className="friend-empty">No pending sent requests.</p> : null}
          </section>

          <section className="friends-panel compact">
            <div className="friends-panel-title">
              <strong>Suggestions</strong>
              <span>{suggestions.length}</span>
            </div>
            {suggestions.map((suggestion) => (
              <article key={suggestion.userId} className="friend-mini-row">
                <FriendAvatar name={suggestion.displayName} />
                <span>
                  <strong>{suggestion.displayName}</strong>
                  <small>{suggestion.reason}</small>
                </span>
                <button onClick={() => onSendRequest(suggestion.userId)}>Request</button>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
