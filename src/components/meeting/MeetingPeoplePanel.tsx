import { useEffect, useMemo, useState } from "react";
import { meetingStageService } from "../../services/meeting/meetingStageService";
import { meetingWaitingRoomService } from "../../services/meeting/meetingWaitingRoomService";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingWaitingEntry } from "../../types/meetingWaitingRoom";
import { AppIcon } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";

type Group = Readonly<{ id:string; label:string; participants:readonly MeetingClientParticipant[] }>;
const groups=(participants:readonly MeetingClientParticipant[]):readonly Group[]=>[
  {id:"hosts",label:"Hosts",participants:participants.filter((item)=>item.role==="host"||item.role==="cohost")},
  {id:"speakers",label:"Speakers",participants:participants.filter((item)=>item.role==="speaker")},
  {id:"participants",label:"Participants",participants:participants.filter((item)=>item.role==="participant")},
  {id:"viewers",label:"Viewers",participants:participants.filter((item)=>item.role==="viewer"||item.role==="guest")},
].filter((group)=>group.participants.length);

export function MeetingPeoplePanel({snapshot,onFocusParticipant}:{snapshot:MeetingClientSnapshot;onFocusParticipant:(id:string|null)=>void}){
  const[query,setQuery]=useState("");const[waiting,setWaiting]=useState<readonly MeetingWaitingEntry[]>([]);const[busy,setBusy]=useState<string|null>(null);const[error,setError]=useState("");
  const participants=snapshot.participantIds.map((id)=>snapshot.participantsById[id]).filter(Boolean);const filtered=useMemo(()=>{const normalized=query.trim().toLowerCase();return normalized?participants.filter((item)=>`${item.displayName} ${item.username??""} ${item.role}`.toLowerCase().includes(normalized)):participants},[participants,query]);
  const loadWaiting=async()=>{if(!snapshot.context||!snapshot.capabilities.canAdmit)return;const result=await meetingWaitingRoomService.list(snapshot.context.roomId);if(result.ok)setWaiting(result.data.filter((entry)=>entry.status==="waiting"));else setError(result.error.message)};
  useEffect(()=>{void loadWaiting();const timer=setInterval(()=>void loadWaiting(),5000);return()=>clearInterval(timer)},[snapshot.context?.roomId,snapshot.capabilities.canAdmit]);
  const run=async(key:string,operation:()=>Promise<{ok:true;data:unknown}|{ok:false;error:{message:string}}>)=>{setBusy(key);setError("");const result=await operation();if(!result.ok)setError(result.error.message);setBusy(null);return result.ok};
  const resolveWaiting=async(entry:MeetingWaitingEntry,decision:"admit"|"deny")=>{const done=await run(entry.id,()=>meetingWaitingRoomService.resolve(entry.id,decision));if(done)await loadWaiting()};
  return <section className="meeting-people-panel" aria-label="Meeting people">
    <label className="meeting-dock-search"><AppIcon name="search" size="sm" /><span className="sr-only">Search meeting people</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search people" /></label>
    <p className="meeting-dock-summary" aria-live="polite">{filtered.length} of {participants.length} connected{waiting.length?` - ${waiting.length} waiting`:""}</p>
    {error?<p className="meeting-dock-error" role="alert">{error}</p>:null}
    <div className="meeting-people-groups">
      {groups(filtered).map((group)=><section key={group.id}><h3>{group.label}<span>{group.participants.length}</span></h3>{group.participants.map((participant)=><article className={participant.id===snapshot.focusedParticipantId?"is-focused":""} key={participant.id}><button type="button" className="meeting-people-person" onClick={()=>onFocusParticipant(participant.id===snapshot.focusedParticipantId?null:participant.id)} aria-label={`Focus ${participant.displayName}`}><VerifiedAvatarFrame userId={participant.userId} label={participant.displayName} avatarUrl={participant.avatarUrl} avatarSeed={participant.identity} verification={participant.verification} size="compact" avatarSize={34}/><span><span><strong>{participant.displayName}{participant.isLocal?" (you)":""}</strong><VerifiedBadge verification={participant.verification} size="xs"/></span><small>{participant.role} - {participant.presence}</small></span><AppIcon name={participant.isSpeaking?"voice":participant.microphoneEnabled?"microphone":"volumeOff"} size="xs"/></button>{snapshot.capabilities.canManageParticipants&&!participant.isLocal&&participant.role!=="host"?<span className="meeting-people-actions">{participant.role==="speaker"?<button type="button" disabled={busy===participant.id} onClick={()=>void run(participant.id,()=>meetingStageService.demoteParticipant(participant.id))}>Audience</button>:<button type="button" disabled={busy===participant.id} onClick={()=>void run(participant.id,()=>meetingStageService.promoteParticipant(participant.id))}>Stage</button>}</span>:null}</article>)}</section>)}
      {!filtered.length?<div className="meeting-dock-empty"><AppIcon name="users" size="lg"/><strong>No matching people</strong><span>Try a different name or role.</span></div>:null}
      {snapshot.capabilities.canAdmit&&waiting.length?<section className="meeting-waiting-group"><h3>Waiting room<span>{waiting.length}</span></h3>{waiting.filter((entry)=>!query.trim()||`${entry.displayName} ${entry.requestedRole}`.toLowerCase().includes(query.toLowerCase())).map((entry)=><article key={entry.id}><span className="meeting-waiting-avatar" aria-hidden="true">{entry.displayName.slice(0,1).toUpperCase()}</span><span><strong>{entry.displayName}</strong><small>{entry.requestedRole}{entry.requestMessage?` - ${entry.requestMessage}`:""}</small></span><span><button type="button" disabled={busy===entry.id} onClick={()=>void resolveWaiting(entry,"admit")}>Admit</button><button type="button" disabled={busy===entry.id} onClick={()=>void resolveWaiting(entry,"deny")}>Deny</button></span></article>)}</section>:null}
    </div>
  </section>;
}
