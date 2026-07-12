import type { FeedItem } from "../../types/feed";
import { AppIcon } from "../AppIcon";

type Props={item:FeedItem;openLabel:string;onOpen?:()=>void;onToggleSave?:()=>void;onMarkRead?:()=>void;onReact?:(emoji?:string)=>void};
export function FeedCardFooter({item,openLabel,onOpen,onToggleSave,onMarkRead,onReact}:Props){return <footer className="feed-v1-footer">
  <div className="feed-v1-footer__proof"><span className="feed-v1-pill"><AppIcon name="eye" size="xs"/>{item.engagement.uniqueExternalViewers}</span>{item.reactions.map(reaction=><button type="button" key={reaction.emoji} className={`feed-v1-pill ${reaction.reactedByCurrentUser?"is-active":""}`} onClick={onReact?()=>onReact(reaction.emoji):undefined} disabled={!onReact} aria-label={`React ${reaction.emoji}, ${reaction.count}`}><span>{reaction.emoji}</span>{reaction.count}</button>)}
    {item.commenters.length?<span className="feed-v1-commenters" aria-label={`${item.commenters.length} recent commenters`}>{item.commenters.slice(0,4).map(commenter=><span key={commenter.id} title={commenter.displayName}>{commenter.avatarUrl?<img src={commenter.avatarUrl} alt=""/>:<span>{commenter.displayName.slice(0,1).toUpperCase()}</span>}</span>)}</span>:null}
    <span className="feed-v1-pill"><AppIcon name="inbox" size="xs"/>{item.commentCount}</span>
  </div>
  {item.commentPreviews.length?<div className="feed-v1-comments" aria-label="Recent comments">{item.commentPreviews.map(comment=><p key={comment.id}><strong>{comment.author?.displayName??"Community member"}</strong><span>{comment.body}</span></p>)}</div>:null}
  <div className="feed-v1-footer__actions">{onReact?<button type="button" onClick={()=>onReact()}><AppIcon name="smile" size="sm"/>React</button>:null}{onToggleSave?<button type="button" className={item.userState.isSaved?"is-active":""} onClick={onToggleSave}><AppIcon name="pin" size="sm"/>{item.userState.isSaved?"Saved":"Save"}</button>:null}{item.userState.isUnread&&onMarkRead?<button type="button" onClick={onMarkRead}><AppIcon name="eye" size="sm"/>Mark read</button>:null}{onOpen?<button type="button" className="feed-v1-footer__open" onClick={onOpen}>{openLabel}<AppIcon name="chevronRight" size="sm"/></button>:null}</div>
</footer>;}

