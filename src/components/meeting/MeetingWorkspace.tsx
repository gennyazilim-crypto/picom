import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import type { MeetingLayoutMode, MeetingSidePanel } from "../../types/meeting";
import { MeetingControlDock } from "./MeetingControlDock";
import { MeetingPreJoin } from "./MeetingPreJoin";
import { MeetingRightDock } from "./MeetingRightDock";
import { MeetingStage } from "./MeetingStage";
import { MeetingTopBar } from "./MeetingTopBar";
import { MeetingWorkspaceStatusSurface } from "./MeetingWorkspaceSurfaces";
import "./MeetingWorkspace.css";

const layouts: readonly MeetingLayoutMode[]=["grid","speaker","screen_share","stage"];

export function MeetingWorkspace() {
  const snapshot=useSyncExternalStore(meetingService.store.subscribe,meetingService.store.getSnapshot,meetingService.store.getSnapshot);
  const [focusMode,setFocusMode]=useState(false);
  const [shareLayoutOverride,setShareLayoutOverride]=useState(false);
  const autoShareLayoutRef=useRef(false);
  const previousLayoutRef=useRef<MeetingLayoutMode>("grid");
  const hasScreenShare=(snapshot.screenShares?.length??0)>0;
  const dockOpen=snapshot.rightDock!=="none"&&!focusMode;
  const toggleDock=()=>meetingService.setRightDock(snapshot.rightDock==="none"?"people":"none");
  const selectDock=(panel:MeetingSidePanel)=>meetingService.setRightDock(panel);
  const cycleLayout=()=>{const next=layouts[(layouts.indexOf(snapshot.layout)+1)%layouts.length];if(hasScreenShare){setShareLayoutOverride(next!=="screen_share");if(next!=="screen_share")autoShareLayoutRef.current=false}meetingService.setLayout(next)};
  const toggleFocus=()=>setFocusMode((current)=>!current);
  const focusParticipant=(id:string|null)=>{meetingService.setFocus(id);if(id)meetingService.setLayout("speaker")};
  const leaveShareLayout=(layout:Extract<MeetingLayoutMode,"grid"|"speaker">)=>{setShareLayoutOverride(true);autoShareLayoutRef.current=false;meetingService.setLayout(layout)};
  useEffect(()=>{if(hasScreenShare){if(!shareLayoutOverride&&snapshot.layout!=="screen_share"){previousLayoutRef.current=snapshot.layout;autoShareLayoutRef.current=true;meetingService.setLayout("screen_share")}return}if(autoShareLayoutRef.current){autoShareLayoutRef.current=false;meetingService.setLayout(previousLayoutRef.current);meetingService.setFocus(snapshot.focusedParticipantId,null)}if(shareLayoutOverride)setShareLayoutOverride(false)},[hasScreenShare,shareLayoutOverride,snapshot.focusedParticipantId,snapshot.layout]);
  return <section className={`meeting-workspace${focusMode?" is-focus-mode":""}${dockOpen?" has-right-dock":""}`} aria-label={snapshot.context?.roomTitle?`${snapshot.context.roomTitle} meeting workspace`:"Picom meeting workspace"}>
    <MeetingTopBar snapshot={snapshot} focusMode={focusMode} onToggleFocus={toggleFocus} onToggleDock={toggleDock} />
    <div className="meeting-workspace__body">
      <main className="meeting-workspace__canvas">
        {snapshot.phase==="prejoin"?<MeetingPreJoin />:<MeetingStage snapshot={snapshot} onFocusParticipant={focusParticipant} onOpenPeople={()=>meetingService.setRightDock("people")} onReturnToGrid={()=>leaveShareLayout("grid")} onReturnToSpeaker={()=>leaveShareLayout("speaker")} />}
        <MeetingWorkspaceStatusSurface snapshot={snapshot} onRetry={()=>{void meetingService.retry()}} onLeave={()=>{void meetingService.leave()}} />
      </main>
      {dockOpen?<MeetingRightDock snapshot={snapshot} onSelect={selectDock} onFocusParticipant={focusParticipant} onClose={()=>meetingService.setRightDock("none")} />:null}
    </div>
    <MeetingControlDock snapshot={snapshot} focusMode={focusMode} onToggleMute={()=>{void meetingService.setMuted(!snapshot.localMedia.muted)}} onToggleDeafen={()=>meetingService.setDeafened(!snapshot.localMedia.deafened)} onCycleLayout={cycleLayout} onToggleDock={toggleDock} onToggleFocus={toggleFocus} onLeave={()=>{void meetingService.leave()}} />
  </section>;
}
