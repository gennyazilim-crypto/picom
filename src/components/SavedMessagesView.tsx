import type { Community } from "../types/community";
import { dateTimeService } from "../services/dateTimeService";
import type { SavedMessageRecord } from "../services/savedMessageService";
import { AppIcon } from "./AppIcon";
import { ProfileDisplayName } from "./ProfileDisplayName";

export function SavedMessagesView({
  items,
  communities,
  onOpen,
  onUnsave,
}: {
  items: SavedMessageRecord[];
  communities: Community[];
  onOpen: (item: SavedMessageRecord) => void;
  onUnsave: (item: SavedMessageRecord) => void;
}) {
  const visibleItems = items.flatMap((item) => {
    const community = communities.find((candidate) => candidate.id === item.communityId);
    const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return community && channel ? [{ item, community, channel }] : [];
  });
  const isEmpty = visibleItems.length === 0;

  return (
    <main className="saved-messages-view" aria-labelledby="saved-messages-title">
      <header className="saved-messages-view__header">
        <div className="saved-messages-view__intro">
          <p className="saved-messages-view__eyebrow">Bookmarks</p>
          <div className="saved-messages-view__title-row">
            <span className="saved-messages-view__mark" aria-hidden="true">
              <AppIcon name="pin" size="md" />
            </span>
            <div className="saved-messages-view__copy">
              <h1 id="saved-messages-title">Saved Messages</h1>
              <p>Jump back to messages you pinned across communities you can still access.</p>
            </div>
          </div>
        </div>
        <dl className="saved-messages-view__stats" aria-label="Saved messages summary">
          <div>
            <dt>Accessible</dt>
            <dd>{visibleItems.length}</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>{items.length}</dd>
          </div>
        </dl>
      </header>

      <section className={`saved-message-list${isEmpty ? " is-empty" : ""}`} aria-label="Saved messages">
        <div className="saved-message-list__toolbar">
          <div className="saved-message-list__toolbar-copy">
            <p className="saved-message-list__toolbar-eyebrow">Library</p>
            <strong className="saved-message-list__toolbar-title">{isEmpty ? "Nothing pinned yet" : "Pinned messages"}</strong>
          </div>
          <span className="saved-message-list__toolbar-meta" aria-live="polite">
            {visibleItems.length} accessible
            {items.length !== visibleItems.length ? ` · ${items.length} saved` : ""}
          </span>
        </div>

        {isEmpty ? (
          <div className="saved-messages-empty">
            <span className="saved-messages-empty__glow" aria-hidden="true" />
            <span className="saved-messages-empty__mark" aria-hidden="true">
              <AppIcon name="pin" size="xl" />
            </span>
            <p className="saved-messages-empty__eyebrow">Private bookmarks</p>
            <strong>No accessible saved messages</strong>
            <p>Pin a message from chat or Mention Feed, then reopen it here anytime — only items you can still access appear in this list.</p>
            <ul className="saved-messages-empty__tips">
              <li>
                <AppIcon name="more" size="sm" />
                <span>Message · context menu · Save</span>
              </li>
              <li>
                <AppIcon name="inbox" size="sm" />
                <span>Mention Feed · Save action</span>
              </li>
            </ul>
          </div>
        ) : (
          <div className="saved-message-list__items">
            {visibleItems.map(({ item, community, channel }) => {
              const author = community.members.find((candidate) => candidate.userId === item.authorId);
              return (
                <article key={item.id} className="saved-message-card">
                  <span className="saved-message-icon" aria-hidden="true">
                    <AppIcon name="pin" size="sm" />
                  </span>
                  <div className="saved-message-card__body">
                    <div className="saved-message-card__meta">
                      <strong>
                        <ProfileDisplayName userId={author?.userId ?? item.authorId} fallback={author?.displayName ?? "Community member"} />
                      </strong>
                      <small>
                        {community.name}
                        <span aria-hidden="true"> · </span>#{channel.name}
                      </small>
                    </div>
                    <p>{item.preview}</p>
                    <time dateTime={item.messageCreatedAt}>{dateTimeService.formatFullTimestamp(item.messageCreatedAt)}</time>
                  </div>
                  <div className="saved-message-card__actions">
                    <button type="button" className="saved-message-card__primary" onClick={() => onOpen(item)}>
                      Jump
                    </button>
                    <button type="button" className="saved-message-card__ghost" onClick={() => onUnsave(item)}>
                      Unsave
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
