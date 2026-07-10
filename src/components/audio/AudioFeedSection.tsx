import type { AudioFeedItem } from "../../types/audio";
import type { Community } from "../../types/community";
import { AudioFeedCard } from "./AudioFeedCard";

export function AudioFeedSection({ items, communities, savedIds, reminderIds, onSelect, onToggleSaved, onToggleReminder, onOpenCommunity }: { items: readonly AudioFeedItem[]; communities: Community[]; savedIds: ReadonlySet<string>; reminderIds: ReadonlySet<string>; onSelect: (item: AudioFeedItem) => void; onToggleSaved: (id: string) => void; onToggleReminder: (id: string) => void; onOpenCommunity: (communityId: string) => void }) {
  if (!items.length) return null;
  return <section className="audio-feed-section" aria-label="Radio and podcast updates"><header><div><p className="eyebrow">Listen on Picom</p><strong>Radio and podcasts</strong></div><span>{items.length} updates</span></header><div>{items.map((item) => <AudioFeedCard key={item.id} item={item} communities={communities} saved={savedIds.has(item.id)} reminderSet={reminderIds.has(item.id)} onSelect={onSelect} onToggleSaved={onToggleSaved} onToggleReminder={onToggleReminder} onOpenCommunity={onOpenCommunity} />)}</div></section>;
}
