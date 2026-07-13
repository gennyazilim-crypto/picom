import type { MouseEvent } from "react";
import type { AudioFeedItem } from "../types/audio";
import type { Attachment, Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { MentionFeedCardEntry } from "./MentionFeedList";
import { AudioFeedCard } from "./audio/AudioFeedCard";

type UnifiedFeedListProps = {
  textItems: MentionItem[];
  audioItems: readonly AudioFeedItem[];
  communities: Community[];
  savedAudioIds: ReadonlySet<string>;
  readAudioIds: ReadonlySet<string>;
  reminderAudioIds: ReadonlySet<string>;
  onOpenImage: (attachment: Attachment) => void;
  onOpenTextInChannel: (item: MentionItem) => void;
  onToggleTextReaction: (id: string, emoji: string) => void;
  onToggleTextSaved: (id: string) => void;
  onMarkTextRead: (id: string) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenTextMore: (event: MouseEvent, item: MentionItem) => void;
  onSelectAudio: (item: AudioFeedItem) => void;
  onToggleAudioSaved: (item: AudioFeedItem) => void;
  onToggleAudioReminder: (id: string) => void;
  onReactAudio: (item: AudioFeedItem) => void;
  onMarkAudioRead: (item: AudioFeedItem) => void;
  onOpenCommunity: (communityId: string) => void;
  onOpenRadio: (item: AudioFeedItem) => void;
  onCopyAudioReference: (item: AudioFeedItem) => void;
  onReportAudio: (item: AudioFeedItem) => void;
};

type UnifiedEntry =
  | Readonly<{ kind: "text"; id: string; createdAt: string; item: MentionItem }>
  | Readonly<{ kind: "audio"; id: string; createdAt: string; item: AudioFeedItem }>;

export function UnifiedFeedList(props: UnifiedFeedListProps) {
  const entries: UnifiedEntry[] = [
    ...props.textItems.map((item): UnifiedEntry => ({ kind: "text", id: item.id, createdAt: item.createdAt, item })),
    ...props.audioItems.map((item): UnifiedEntry => ({ kind: "audio", id: item.id, createdAt: item.createdAt, item })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id));

  if (!entries.length) {
    return <div className="mention-empty-state"><strong>No mentions match this view.</strong><span>Try another tab or clear the active quick filter.</span></div>;
  }

  return (
    <section className="unified-feed-list" aria-label="Text, Radio, and Podcast mentions">
      {entries.map((entry) => entry.kind === "text" ? (
        <MentionFeedCardEntry
          key={`text-${entry.id}`}
          item={entry.item}
          communities={props.communities}
          onOpenImage={props.onOpenImage}
          onOpenInChannel={props.onOpenTextInChannel}
          onToggleReaction={props.onToggleTextReaction}
          onToggleSaved={props.onToggleTextSaved}
          onMarkRead={props.onMarkTextRead}
          onOpenProfile={props.onOpenProfile}
          onOpenMore={props.onOpenTextMore}
        />
      ) : (
        <AudioFeedCard
          key={`audio-${entry.id}`}
          item={entry.item}
          communities={props.communities}
          saved={props.savedAudioIds.has(entry.item.id)}
          unread={Boolean(entry.item.isUnread && !props.readAudioIds.has(entry.item.id))}
          reminderSet={props.reminderAudioIds.has(entry.item.id)}
          onSelect={props.onSelectAudio}
          onToggleSaved={props.onToggleAudioSaved}
          onToggleReminder={props.onToggleAudioReminder}
          onReact={props.onReactAudio}
          onMarkRead={props.onMarkAudioRead}
          onOpenCommunity={props.onOpenCommunity}
          onOpenRadio={props.onOpenRadio}
          onOpenProfile={props.onOpenProfile}
          onCopyReference={props.onCopyAudioReference}
          onReport={props.onReportAudio}
        />
      ))}
    </section>
  );
}
