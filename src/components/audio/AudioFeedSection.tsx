import type { MouseEvent } from "react";
import type { AudioFeedItem } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { AudioFeedCard } from "./AudioFeedCard";

type AudioFeedSectionProps = {
  items: readonly AudioFeedItem[]; communities: Community[]; savedIds: ReadonlySet<string>; readIds: ReadonlySet<string>; reminderIds: ReadonlySet<string>;
  onSelect: (item: AudioFeedItem) => void; onToggleSaved: (item: AudioFeedItem) => void; onToggleReminder: (id: string) => void;
  onReact: (item: AudioFeedItem) => void; onMarkRead: (item: AudioFeedItem) => void; onOpenCommunity: (communityId: string) => void;
  onOpenRadio: (item: AudioFeedItem) => void; onOpenProfile: (event: MouseEvent, member: Member) => void;
};

export function AudioFeedSection({ items, communities, savedIds, readIds, reminderIds, onSelect, onToggleSaved, onToggleReminder, onReact, onMarkRead, onOpenCommunity, onOpenRadio, onOpenProfile }: AudioFeedSectionProps) {
  if (!items.length) return null;
  return <section className="audio-feed-section" aria-label="Radio and podcast updates"><header><div><p className="eyebrow">Listen on Picom</p><strong>Radio and podcasts</strong></div><span>{items.length} updates</span></header><div>{items.map((item) => <AudioFeedCard key={item.id} item={item} communities={communities} saved={savedIds.has(item.id)} unread={Boolean(item.isUnread && !readIds.has(item.id))} reminderSet={reminderIds.has(item.id)} onSelect={onSelect} onToggleSaved={onToggleSaved} onToggleReminder={onToggleReminder} onReact={onReact} onMarkRead={onMarkRead} onOpenCommunity={onOpenCommunity} onOpenRadio={onOpenRadio} onOpenProfile={onOpenProfile} />)}</div></section>;
}
