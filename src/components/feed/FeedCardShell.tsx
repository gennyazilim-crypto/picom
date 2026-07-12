import type { PropsWithChildren,ReactNode } from "react";
import type { FeedItem } from "../../types/feed";
import type { VerificationSummary } from "../../types/verification";
import { AppIcon,type IconName } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";

const sourceIcon:Record<FeedItem["source"]["type"],IconName>={text_message:"hash",radio_session:"voice",radio_comment:"voice",podcast_episode:"headphones",podcast_comment:"headphones"};
function timestamp(value:string){return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}

type Props=PropsWithChildren<{item:FeedItem;reason:string;actions?:ReactNode;onOpenProfile?:(userId:string)=>void}>;
export function FeedCardShell({item,reason,actions,children,onOpenProfile}:Props){const verification:VerificationSummary|undefined=item.author.verificationType?{status:"approved",type:item.author.verificationType}:undefined;return <article className={`feed-v1-card feed-v1-card--${item.source.type}`} aria-labelledby={`feed-card-${item.id}`}>
  <header className="feed-v1-card__header">
    <button type="button" className="feed-v1-card__avatar" onClick={onOpenProfile?()=>onOpenProfile(item.author.id):undefined} disabled={!onOpenProfile} aria-label={`Open ${item.author.displayName} profile`}>
      <VerifiedAvatarFrame userId={item.author.id} label={item.author.displayName} avatarUrl={item.author.avatarUrl} avatarSeed={item.author.id} size="medium" verification={null}/>
    </button>
    <div className="feed-v1-card__identity"><div><button type="button" onClick={onOpenProfile?()=>onOpenProfile(item.author.id):undefined} disabled={!onOpenProfile} id={`feed-card-${item.id}`}>{item.author.displayName}</button>{verification?<VerifiedBadge verification={verification} size="xs"/>:null}</div><span>@{item.author.username}</span></div>
    <div className="feed-v1-card__context"><span><AppIcon name={sourceIcon[item.source.type]} size="xs"/>{item.community?.name??"Picom"}</span><time dateTime={item.createdAt}>{timestamp(item.createdAt)}</time></div>
    {actions?<div className="feed-v1-card__header-actions">{actions}</div>:null}
  </header>
  <div className="feed-v1-card__reason">{item.userState.isDirectMention?<span aria-hidden="true">@</span>:<AppIcon name={item.userState.isFriendAuthored||item.userState.isFriendEngaged?"users":"eye"} size="xs"/>}<span>{reason}</span></div>
  <div className="feed-v1-card__body">{children}</div>
</article>;}

