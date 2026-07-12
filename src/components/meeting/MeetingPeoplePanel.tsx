import { useMemo, useState } from "react";
import { meetingStageService } from "../../services/meeting/meetingStageService";
import { meetingControlService } from "../../services/meeting/meetingControlService";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import { MeetingWaitingRoomHostQueue } from "./MeetingWaitingRoomHostQueue";
import { useMeetingParticipantActionsOptional } from "./MeetingParticipantActionsProvider";

type Group = Readonly<{ id:string; label:string; participants:readonly MeetingClientParticipant[] }>;
const groups=(participants:readonly MeetingClientParticipant[]):readonly Group[]=>[
  {id:"hosts",label:"Hosts",participants:participants.filter((item)=>item.role==="host"||item.role==="cohost")},
  {id:"speakers",label:"Speakers",participants:participants.filter((item)=>item.role==="speaker")},
  {id:"participants",label:"Participants",participants:participants.filter((item)=>item.role==="participant")},
  {id:"viewers",label:"Viewers",participants:participants.filter((item)=>item.role==="viewer"||item.role==="guest")},
].filter((group)=>group.participants.length);

export function MeetingPeoplePanel({snapshot,onFocusParticipant}:{snapshot:MeetingClientSnapshot;onFocusParticipant:(id:string|null)=>void}){
  const[query,setQuery]=useState("");const[busy,setBusy]=useState<string|null>(null);const[error,setError]=useState("");const participantActions=useMeetingParticipantActionsOptional();
  const participants=snapshot.participantIds.map((id)=>snapshot.participantsById[id]).filter(Boolean);const filtered=useMemo(()=>{const normalized=query.trim().toLowerCase();return normalized?participants.filter((item)=>`${item.displayName} ${item.username??""} ${item.role}`.toLowerCase().includes(normalized)):participants},[participants,query]);const handEntries=(snapshot.stageQueue??[]).filter((entry)=>entry.handRaised).sort((left,right)=>left.handSequence-right.handSequence);const handByParticipant=new Map(handEntries.map((entry)=>[entry.participantId,entry]));
  const run=async(key:string,operation:()=>Promise<{ok:true;data:unknown}|{ok:false;error:{message:string}}>)=>{setBusy(key);setError("");const result=await operation();if(!result.ok)setError(result.error.message);setBusy(null);return result.ok};
  return <section className="meeting-people-panel" aria-label="Meeting people">
    <label className="meeting-dock-search"><AppIcon name="search" size="sm" /><span className="sr-only">Search meeting people</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search people" /></label>
    <p className="meeting-dock-summary" aria-live="polite">{filtered.length} of {participants.length} connected</p>
    {error?<p className="meeting-dock-error" role="alert">{error}</p>:null}
    <div className="meeting-people-groups">
      {handEntries.length?<section className="meeting-raised-hands"><h3>Raised hands<span>{handEntries.length}</span></h3>{handEntries.map((entry)=><article className={entry.acknowledgedAt?"is-acknowledged":""} key={entry.participantId}><span className="meeting-hand-order" aria-label={`Hand number ${entry.handSequence}`}>{entry.handSequence}</span><span><strong>{entry.displayName}</strong><small>{entry.stageRequestStatus==="requested"?"Request to speak":entry.acknowledgedAt?"Host acknowledged":"Waiting for host"}</small></span>{snapshot.capabilities.canManageParticipants&&!entry.acknowledgedAt?<button type="button" disabled={busy===`hand:${entry.participantId}`} onClick={()=>void run(`hand:${entry.participantId}`,()=>meetingControlService.acknowledgeHand(entry.participantId))}>Acknowledge</button>:<span className="meeting-hand-status" aria-label={entry.acknowledgedAt?"Acknowledged":"Raised hand"}>{entry.acknowledgedAt?"Seen":"✋"}</span>}</article>)}</section>:null}
      {groups(filtered).map((group)=><section key={group.id}><h3>{group.label}<span>{group.participants.length}</span></h3>{group.participants.map((participant)=>{const hand=handByParticipant.get(participant.id);return <article className={`${participant.id===snapshot.focusedParticipantId?"is-focused ":""}${hand?"is-hand-raised":""}`.trim()} key={participant.id} onContextMenu={(event)=>participantActions?.openMenu(event,participant)}><button type="button" className="meeting-people-person" onClick={()=>onFocusParticipant(participant.id===snapshot.focusedParticipantId?null:participant.id)} aria-label={`Focus ${participant.displayName}`}><VerifiedAvatarFrame userId={participant.userId} label={participant.displayName} avatarUrl={participant.avatarUrl} avatarSeed={participant.identity} verification={participant.verification} size="compact" avatarSize={34}/><span><span><strong>{participant.displayName}{participant.isLocal?" (you)":""}</strong><VerifiedBadge verification={participant.verification} size="xs"/>{hand?<b className="meeting-hand-badge" title={hand.acknowledgedAt?"Raised hand acknowledged":"Raised hand"}>✋</b>:null}</span><small>{participant.role} - {participant.presence}</small></span><AppIcon name={participant.isSpeaking?"voice":participant.microphoneEnabled?"microphone":"volumeOff"} size="xs"/></button><span className="meeting-people-actions">{snapshot.capabilities.canManageParticipants&&!participant.isLocal&&participant.role!=="host"?(participant.role==="speaker"?<button type="button" disabled={busy===participant.id} onClick={()=>void run(participant.id,()=>meetingStageService.demoteParticipant(participant.id))}>Audience</button>:<button type="button" disabled={busy===participant.id} onClick={()=>void run(participant.id,()=>meetingStageService.promoteParticipant(participant.id))}>Stage</button>):null}{participantActions?<button type="button" aria-label={`More actions for ${participant.displayName}`} onClick={(event)=>participantActions.openMenu(event,participant)}><AppIcon name="more" size="xs"/></button>:null}</span></article>})}</section>)}
      {!filtered.length?<div className="meeting-dock-empty"><AppIcon name="users" size="lg"/><strong>No matching people</strong><span>Try a different name or role.</span></div>:null}
      <MeetingWaitingRoomHostQueue roomId={snapshot.context?.roomId??null} canAdmit={snapshot.capabilities.canAdmit} query={query}/>
    </div>
  </section>;
}
