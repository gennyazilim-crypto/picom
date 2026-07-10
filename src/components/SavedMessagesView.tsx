import type { Community } from "../types/community";
import { dateTimeService } from "../services/dateTimeService";
import type { SavedMessageRecord } from "../services/savedMessageService";
import { AppIcon } from "./AppIcon";

export function SavedMessagesView({ items, communities, onBack, onOpen, onUnsave }: { items: SavedMessageRecord[]; communities: Community[]; onBack: () => void; onOpen: (item: SavedMessageRecord) => void; onUnsave: (item: SavedMessageRecord) => void }) {
  const visibleItems = items.flatMap((item) => { const community = communities.find((candidate) => candidate.id === item.communityId); const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId); return community && channel ? [{ item, community, channel }] : []; });
  return <main className="saved-messages-view"><header><button className="icon-button" aria-label="Back to community" onClick={onBack}><AppIcon name="chevronRight" size="sm" /></button><div><span className="eyebrow">Bookmarks</span><h2>Saved Messages</h2><p>Your private list of currently accessible messages.</p></div></header><div className="saved-message-list">
    {visibleItems.length ? visibleItems.map(({ item, community, channel }) => { const author = community.members.find((candidate) => candidate.userId === item.authorId); return <article key={item.id}><span className="saved-message-icon"><AppIcon name="pin" size="sm" /></span><div><strong>{author?.displayName ?? "Community member"}</strong><small>{community.name} · #{channel.name}</small><p>{item.preview}</p><time>{dateTimeService.formatFullTimestamp(item.messageCreatedAt)}</time></div><div><button onClick={() => onOpen(item)}>Jump</button><button className="secondary-action" onClick={() => onUnsave(item)}>Unsave</button></div></article>; }) : <div className="empty-state"><AppIcon name="pin" size="xl" /><strong>No accessible saved messages</strong><p>Use a message context menu or Mention Feed Save action.</p></div>}
  </div></main>;
}
