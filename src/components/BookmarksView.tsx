import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BookmarkCollection, BookmarkContentType, BookmarkRecord } from "../types/bookmarks";
import { bookmarkContentTypes } from "../types/bookmarks";
import { bookmarkService } from "../services/bookmarkService";
import { AppIcon } from "./AppIcon";
import "./BookmarksView.css";

const labels: Record<BookmarkContentType, string> = {
  feed: "Feed post",
  message: "Message",
  radio: "Radio",
  podcast: "Podcast",
  event: "Event",
  file: "File",
  link: "Link",
};

function bookmarkTitle(item: BookmarkRecord): string {
  return item.metadata.title?.trim() || item.metadata.sourceLabel?.trim() || labels[item.contentType];
}

function bookmarkPreview(item: BookmarkRecord): string {
  return item.metadata.preview?.trim() || item.metadata.url?.trim() || "Saved from Picom";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function collectionCount(items: readonly BookmarkRecord[], collectionId: string): number {
  return items.filter((item) => item.collectionId === collectionId).length;
}

export function BookmarksView({ onBack, onOpen }: { onBack: () => void; onOpen: (bookmark: BookmarkRecord) => void }) {
  const [items, setItems] = useState<BookmarkRecord[]>([]);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>();
  const [selectedType, setSelectedType] = useState<BookmarkContentType | "all">("all");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [nextItems, nextCollections] = await Promise.all([bookmarkService.listBookmarks(), bookmarkService.listCollections()]);
    setItems(nextItems);
    setCollections(nextCollections);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    return bookmarkService.subscribe(() => {
      void refresh();
    });
  }, []);

  const scopedItems = useMemo(
    () => (selectedCollectionId ? items.filter((item) => item.collectionId === selectedCollectionId) : items),
    [items, selectedCollectionId],
  );

  const visibleItems = useMemo(
    () => (selectedType === "all" ? scopedItems : scopedItems.filter((item) => item.contentType === selectedType)),
    [scopedItems, selectedType],
  );

  const createCollection = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCollectionName.trim()) return;
    const created = await bookmarkService.createCollection(newCollectionName);
    if (created) {
      setNewCollectionName("");
      setCollections((current) => [created, ...current]);
      setSelectedCollectionId(created.id);
    }
  };

  const remove = async (item: BookmarkRecord) => {
    setBusyId(item.id);
    const deleted = await bookmarkService.deleteBookmark(item.id);
    if (deleted) setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setBusyId(null);
  };

  return (
    <main className="bookmarks-workspace" aria-labelledby="bookmarks-title">
      <header className="bookmarks-workspace__header">
        <div className="bookmarks-workspace__header-main">
          <div className="bookmarks-workspace__intro">
            <p className="bookmarks-workspace__eyebrow">Profile library</p>
            <div className="bookmarks-workspace__title-row">
              <span className="bookmarks-workspace__mark" aria-hidden="true">
                <AppIcon name="pin" size="md" />
              </span>
              <h1 id="bookmarks-title">Bookmarks</h1>
            </div>
            <p className="bookmarks-workspace__lede">
              Private items saved from Picom content you can currently access.
            </p>
          </div>
        </div>
        <dl className="bookmarks-workspace__stats" aria-label="Bookmark summary">
          <div>
            <dt>Saved</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>Collections</dt>
            <dd>{collections.length}</dd>
          </div>
          <div>
            <dt>View</dt>
            <dd>{selectedCollectionId ? collections.find((collection) => collection.id === selectedCollectionId)?.name ?? "Collection" : "All"}</dd>
          </div>
        </dl>
      </header>
      <div className="bookmarks-workspace__body">
        <aside className="bookmarks-sidebar" aria-label="Bookmark collections and filters">
          <div className="bookmarks-sidebar__head">
            <p className="bookmarks-sidebar__eyebrow">Library</p>
            <strong className="bookmarks-sidebar__title">Collections</strong>
            <span className="bookmarks-sidebar__subtitle">{collections.length} custom · {items.length} saved</span>
          </div>

          <nav className="bookmarks-sidebar__nav" aria-label="Bookmark collections">
            <button
              type="button"
              className={`bookmarks-collection${!selectedCollectionId ? " is-active" : ""}`}
              aria-current={!selectedCollectionId ? "page" : undefined}
              onClick={() => setSelectedCollectionId(undefined)}
            >
              <span className="bookmarks-collection__icon" aria-hidden="true">
                <AppIcon name="pin" size="sm" />
              </span>
              <span className="bookmarks-collection__label">All bookmarks</span>
              <strong className="bookmarks-collection__count">{items.length}</strong>
            </button>

            {collections.length ? (
              <div className="bookmarks-sidebar__group">
                <p className="bookmarks-sidebar__group-label">Your collections</p>
                {collections.map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    className={`bookmarks-collection${selectedCollectionId === collection.id ? " is-active" : ""}`}
                    aria-current={selectedCollectionId === collection.id ? "page" : undefined}
                    onClick={() => setSelectedCollectionId(collection.id)}
                  >
                    <span className="bookmarks-collection__icon" aria-hidden="true">
                      <AppIcon name="hash" size="sm" />
                    </span>
                    <span className="bookmarks-collection__label" title={collection.name}>
                      {collection.name}
                    </span>
                    <strong className="bookmarks-collection__count">{collectionCount(items, collection.id)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="bookmarks-sidebar__empty">Create a collection to organize saved items.</p>
            )}
          </nav>

          <form className="bookmarks-new-collection" onSubmit={(event) => void createCollection(event)}>
            <label htmlFor="bookmark-collection-name">New collection</label>
            <div className="bookmarks-new-collection__row">
              <input
                id="bookmark-collection-name"
                value={newCollectionName}
                maxLength={80}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="e.g. Important"
                autoComplete="off"
              />
              <button type="submit" disabled={!newCollectionName.trim()} aria-label="Create collection">
                <AppIcon name="plus" size="sm" />
              </button>
            </div>
          </form>
        </aside>

        <section className="bookmarks-content" aria-label="Saved Picom content">
          <div className="bookmarks-content__toolbar">
            <div className="bookmarks-content__toolbar-copy">
              <p className="bookmarks-content__toolbar-eyebrow">Saved items</p>
              <strong className="bookmarks-content__toolbar-title">
                {selectedType === "all" ? "All types" : labels[selectedType]}
              </strong>
            </div>
            <span className="bookmarks-content__toolbar-meta" aria-live="polite">
              {loading ? "Loading…" : `${visibleItems.length} shown`}
            </span>
          </div>

          <nav className="bookmarks-type-filters" aria-label="Bookmark type filters">
            <button type="button" className={selectedType === "all" ? "is-active" : ""} onClick={() => setSelectedType("all")}>
              All
            </button>
            {bookmarkContentTypes.map((type) => (
              <button type="button" key={type} className={selectedType === type ? "is-active" : ""} onClick={() => setSelectedType(type)}>
                {labels[type]}
              </button>
            ))}
          </nav>

          {loading ? (
            <div className="bookmarks-state" role="status">
              <span className="bookmarks-state__mark" aria-hidden="true">
                <AppIcon name="search" size="lg" />
              </span>
              <strong>Loading bookmarks</strong>
              <span>Fetching private items you can still access.</span>
            </div>
          ) : null}

          {!loading && !visibleItems.length ? (
            <div className="bookmarks-state">
              <span className="bookmarks-state__mark" aria-hidden="true">
                <AppIcon name="pin" size="lg" />
              </span>
              <strong>No bookmarks in this view</strong>
              <span>
                {selectedCollectionId || selectedType !== "all"
                  ? "Try another collection or type filter, or save a supported Picom item."
                  : "Save a message, event, feed post, or other supported Picom item to keep it here."}
              </span>
              <div className="bookmarks-state__actions">
                {(selectedCollectionId || selectedType !== "all") ? (
                  <button
                    type="button"
                    className="bookmarks-state__button"
                    onClick={() => {
                      setSelectedCollectionId(undefined);
                      setSelectedType("all");
                    }}
                  >
                    Show all bookmarks
                  </button>
                ) : null}
                <button type="button" className="bookmarks-state__button bookmarks-state__button--ghost" onClick={onBack}>
                  Back to profile
                </button>
              </div>
            </div>
          ) : null}

          {!loading && visibleItems.length ? (
            <div className="bookmarks-list">
              {visibleItems.map((item) => (
                <article className="bookmark-card" key={item.id}>
                  <div className="bookmark-card__kind">{labels[item.contentType]}</div>
                  <button type="button" className="bookmark-card__open" onClick={() => onOpen(item)}>
                    <strong>{bookmarkTitle(item)}</strong>
                    <span>{bookmarkPreview(item)}</span>
                    <small>Saved {formatDate(item.createdAt)}</small>
                  </button>
                  <button
                    type="button"
                    className="bookmark-card__remove"
                    disabled={busyId === item.id}
                    onClick={() => void remove(item)}
                    aria-label={`Remove ${bookmarkTitle(item)} from bookmarks`}
                  >
                    <AppIcon name="trash" size="sm" />
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
