import { useEffect, useRef, useSyncExternalStore } from "react";
import { meetingCaptionAvailabilityService } from "../../services/meeting/meetingCaptionAvailabilityService";
import { meetingCaptionService } from "../../services/meeting/meetingCaptionService";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingSidePanel } from "../../types/meeting";
import { AppIcon } from "../AppIcon";
import { MeetingChatPanel } from "./MeetingChatPanel";
import { MeetingCaptionPanel } from "./MeetingCaptionPanel";
import { MeetingInfoPanel } from "./MeetingInfoPanel";
import { MeetingPeoplePanel } from "./MeetingPeoplePanel";
import "./MeetingRightDock.css";

type EnabledPanel=Extract<MeetingSidePanel,"people"|"chat"|"captions"|"info">;
const labels:Record<EnabledPanel,string>={people:"People",chat:"Chat",captions:"Captions",info:"Info"};

export function MeetingRightDock({snapshot,onSelect,onFocusParticipant,onClose}:{snapshot:MeetingClientSnapshot;onSelect:(panel:MeetingSidePanel)=>void;onFocusParticipant:(id:string|null)=>void;onClose:()=>void}){
  const loadedSession=useRef<string|null>(null);const caption=useSyncExternalStore(meetingCaptionService.subscribe,meetingCaptionService.getSnapshot,meetingCaptionService.getSnapshot);const captions=meetingCaptionAvailabilityService.getAvailability(snapshot,caption);const tabs:readonly EnabledPanel[] = captions.visible?["people","chat","captions","info"]:["people","chat","info"];const active:EnabledPanel=tabs.includes(snapshot.rightDock as EnabledPanel)?snapshot.rightDock as EnabledPanel:"people";const storageKey=snapshot.context?`picom.meeting-dock.${snapshot.context.sessionId}`:null;
  useEffect(()=>{if(!storageKey||loadedSession.current===storageKey)return;loadedSession.current=storageKey;try{const saved=localStorage.getItem(storageKey) as EnabledPanel|null;if(saved&&tabs.includes(saved)&&saved!==snapshot.rightDock)onSelect(saved)}catch{return}},[storageKey,tabs.join("|"),snapshot.rightDock,onSelect]);
  const select=(panel:EnabledPanel)=>{try{if(storageKey)localStorage.setItem(storageKey,panel)}catch{ /* Session preference remains in memory. */ }onSelect(panel)};
  return <aside className="meeting-right-dock meeting-right-dock-v2" aria-label="Meeting side panel"><header><div><small>Meeting dock</small><strong>{labels[active]}</strong></div><button type="button" aria-label="Close meeting side panel" onClick={onClose}><AppIcon name="close" size="sm"/></button></header><nav aria-label="Meeting panel sections">{tabs.map((tab)=><button type="button" key={tab} className={active===tab?"active":""} aria-current={active===tab?"page":undefined} onClick={()=>select(tab)}>{labels[tab]}{tab==="people"?<span>{snapshot.participantIds.length}</span>:null}</button>)}</nav><div className="meeting-right-dock__content">{active==="people"?<MeetingPeoplePanel snapshot={snapshot} onFocusParticipant={onFocusParticipant}/>:active==="chat"?<MeetingChatPanel snapshot={snapshot}/>:active==="captions"?<MeetingCaptionPanel caption={caption}/>:active==="info"?<MeetingInfoPanel snapshot={snapshot}/>:null}</div></aside>;
}
