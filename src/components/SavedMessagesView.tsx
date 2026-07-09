import type { Community } from "../types/community";
import { dateTimeService } from "../services/dateTimeService";
import type { SavedMessageRecord } from "../services/savedMessageService";
import { AppIcon } from "./AppIcon";

export function SavedMessagesView({items,communities,onBack,onOpen}: {items:SavedMessageRecord[];communities:Community[];onBack:()=>void;onOpen:(item:SavedMessageRecord)=>void}) {
  return <main className="saved-messages-view"><header><button className="icon-button" aria-label="Back to community" onClick={onBack}><AppIcon name="chevronRight" size="sm" /></button><div><span className="eyebrow">Bookmarks</span><h2>Saved Messages</h2><p>Your private list of important messages.</p></div></header><div className="saved-message-list">
    {items.length?items.map((item)=>{const community=communities.find((candidate)=>candidate.id===item.communityId);const channel=community?.categories.flatMap((category)=>category.channels).find((candidate)=>candidate.id===item.channelId);const author=community?.members.find((candidate)=>candidate.userId===item.authorId);return <article key={item.id}><span className="saved-message-icon"><AppIcon name="pin" size="sm" /></span><div><strong>{author?.displayName??"Saved message"}</strong><small>{community?.name??"Accessible community"} · {channel?`#${channel.name}`:"channel"}</small><p>{item.preview??"Open the original message to view its content."}</p><time>{dateTimeService.formatFullTimestamp(item.messageCreatedAt??item.createdAt)}</time></div><button onClick={()=>onOpen(item)}>Jump</button></article>;}):<div className="empty-state"><AppIcon name="pin" size="xl" /><strong>No saved messages</strong><p>Use a message context menu or Mention Feed Save action.</p></div>}
  </div></main>;
}
