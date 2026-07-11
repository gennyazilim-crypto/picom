import type { MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingSidePanel } from "../../types/meeting";
import { AppIcon } from "../AppIcon";

const tabs: ReadonlyArray<{id:Extract<MeetingSidePanel,"people"|"info">;label:string}>=[{id:"people",label:"People"},{id:"info",label:"Info"}];

export function MeetingRightDock({snapshot,onSelect,onClose}:{snapshot:MeetingClientSnapshot;onSelect:(panel:MeetingSidePanel)=>void;onClose:()=>void}) {
  const active=snapshot.rightDock==="info"?"info":"people";
  const participants=snapshot.participantIds.map((id)=>snapshot.participantsById[id]).filter(Boolean);
  return <aside className="meeting-right-dock" aria-label="Meeting side panel">
    <header><div><small>Meeting dock</small><strong>{active==="people"?`${participants.length} people`:"Room information"}</strong></div><button type="button" aria-label="Close meeting side panel" onClick={onClose}><AppIcon name="close" size="sm" /></button></header>
    <nav aria-label="Meeting panel sections">{tabs.map((tab)=><button type="button" key={tab.id} className={active===tab.id?"active":""} aria-current={active===tab.id?"page":undefined} onClick={()=>onSelect(tab.id)}>{tab.label}</button>)}</nav>
    <div className="meeting-right-dock__content">
      {active==="people"?<div className="meeting-dock-people">{participants.length?participants.map((participant)=><button type="button" key={participant.id} className="meeting-dock-person" onClick={()=>onSelect("people")} aria-label={`${participant.displayName}, ${participant.role}`}><span aria-hidden="true">{participant.displayName.slice(0,1).toUpperCase()}</span><span><strong>{participant.displayName}</strong><small>{participant.role} · {participant.presence}</small></span>{participant.isSpeaking?<AppIcon name="voice" size="xs" />:participant.microphoneEnabled?<AppIcon name="microphone" size="xs" />:<AppIcon name="volumeOff" size="xs" />}</button>):<div className="meeting-dock-empty"><AppIcon name="users" size="lg" /><strong>No participants yet</strong><span>The list updates when people join.</span></div>}</div>:<dl className="meeting-room-info"><div><dt>Room</dt><dd>{snapshot.context?.roomTitle??"Meeting"}</dd></div><div><dt>Connection</dt><dd>{snapshot.phase}</dd></div><div><dt>Layout</dt><dd>{snapshot.layout}</dd></div><div><dt>Role</dt><dd>{snapshot.role??"Not assigned"}</dd></div><div><dt>Noise Shield</dt><dd>{snapshot.noiseShield.status}</dd></div></dl>}
    </div>
  </aside>;
}
