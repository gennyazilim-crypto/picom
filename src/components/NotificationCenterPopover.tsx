import { useEffect, useMemo, useState } from "react";
import { dateTimeService } from "../services/dateTimeService";
import { notificationCenterService, type NotificationCenterCategory, type NotificationCenterItem } from "../services/notificationCenterService";
import { AppIcon, type IconName } from "./AppIcon";

type Tab = "all" | "mentions" | "replies" | "reactions" | "system";
const tabs: ReadonlyArray<Readonly<{id:Tab;label:string}>>=[{id:"all",label:"All"},{id:"mentions",label:"Mentions"},{id:"replies",label:"Replies"},{id:"reactions",label:"Reactions"},{id:"system",label:"System"}];
function matches(category: NotificationCenterCategory, tab: Tab) { if(tab==="all")return true; if(tab==="mentions")return category==="mention"; if(tab==="replies")return category==="reply"; if(tab==="reactions")return category==="reaction"; return category==="system"||category==="dm"||category==="event"; }
function icon(category: NotificationCenterCategory): IconName { if(category==="mention")return "bell"; if(category==="reply")return "reply"; if(category==="reaction")return "smile"; if(category==="dm")return "inbox"; if(category==="event")return "users"; return "settings"; }

export function NotificationCenterPopover({ items, onClose, onOpenSource }: { items: NotificationCenterItem[]; onClose:()=>void; onOpenSource:(item:NotificationCenterItem)=>void }) {
  const [tab,setTab]=useState<Tab>("all");
  const filtered=useMemo(()=>items.filter((item)=>matches(item.category,tab)),[items,tab]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>event.key==="Escape"&&onClose(); window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key);},[onClose]);
  return (
    <div className="notification-center-layer" onPointerDown={onClose}>
      <section className="notification-center-popover" role="dialog" aria-label="Notification center" onPointerDown={(event)=>event.stopPropagation()}>
        <header><div><span className="eyebrow">Inbox</span><h2>Notifications</h2></div><div><button onClick={()=>notificationCenterService.markAllRead()}>Mark all read</button><button className="icon-button" aria-label="Close notifications" onClick={onClose}><AppIcon name="close" size="sm" /></button></div></header>
        <nav aria-label="Notification filters">{tabs.map((item)=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}>{item.label}</button>)}</nav>
        <div className="notification-center-list">
          {filtered.length ? filtered.map((item)=><article key={item.id} className={`notification-center-row ${item.readAt?"":"unread"}`}>
            <span className="notification-row-icon"><AppIcon name={icon(item.category)} size="sm" /></span>
            <button className="notification-row-copy" onClick={()=>{notificationCenterService.markRead(item.id);onOpenSource(item);}}><strong>{item.title}</strong><span>{item.preview}</span><small>{item.context.label} · {dateTimeService.formatNotificationTimestamp(item.createdAt)}</small></button>
            <div className="notification-row-actions">
              {!item.readAt?<button className="notification-read-dot" aria-label={`Mark ${item.title} read`} onClick={()=>notificationCenterService.markRead(item.id)} />:null}
              <button className="notification-delete-button" aria-label={`Remove ${item.title}`} title="Remove notification" onClick={()=>notificationCenterService.delete(item.id)}><AppIcon name="trash" size="xs" /></button>
            </div>
          </article>) : <div className="notification-center-empty"><AppIcon name="inbox" size="xl" /><strong>No notifications here</strong><span>New activity will appear in this tab.</span></div>}
        </div>
      </section>
    </div>
  );
}

