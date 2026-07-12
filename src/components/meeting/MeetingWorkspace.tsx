import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import { meetingHostControlService } from "../../services/meeting/meetingHostControlService";
import type { MeetingLayoutMode, MeetingSidePanel } from "../../types/meeting";
import { MeetingControlDock } from "./MeetingControlDock";
import { MeetingPreJoin } from "./MeetingPreJoin";
import { MeetingRightDock } from "./MeetingRightDock";
import { MeetingStage } from "./MeetingStage";
import { MeetingTopBar } from "./MeetingTopBar";
import { MeetingWorkspaceStatusSurface } from "./MeetingWorkspaceSurfaces";
import { MeetingParticipantActionsProvider } from "./MeetingParticipantActionsProvider";
import "./MeetingWorkspace.css";

const layouts: readonly MeetingLayoutMode[]=["grid","speaker","screen_share","stage"];

export function MeetingWorkspace({onExit}:{onExit?:()=>void}={}) {
  const snapshot=useSyncExternalStore(meetingService.store.subscribe,meetingService.store.getSnapshot,meetingService.store.getSnapshot);
  const hostState=useSyncExternalStore(meetingHostControlService.subscribe,meetingHostControlService.getSnapshot,meetingHostControlService.getSnapshot);
  const [focusMode,setFocusMode]=useState(false);
  const [shareLayoutOverride,setShareLayoutOverride]=useState(false);
  const autoShareLayoutRef=useRef(false);
  const previousLayoutRef=useRef<MeetingLayoutMode>("grid");
  const hasScreenShare=(snapshot.screenShares?.length??0)>0;
  const admissionOnly=Boolean(snapshot.waitingEntry&&snapshot.waitingEntry.status!=="admitted"&&snapshot.phase!=="connected");
  const dockOpen=snapshot.rightDock!=="none"&&!focusMode&&!admissionOnly;
  const toggleDock=()=>meetingService.setRightDock(snapshot.rightDock==="none"?"people":"none");
  const selectDock=(panel:MeetingSidePanel)=>meetingService.setRightDock(panel);
  const cycleLayout=()=>{const next=layouts[(layouts.indexOf(snapshot.layout)+1)%layouts.length];if(hasScreenShare){setShareLayoutOverride(next!=="screen_share");if(next!=="screen_share")autoShareLayoutRef.current=false}meetingService.setLayout(next)};
  const toggleFocus=()=>setFocusMode((current)=>!current);
  const focusParticipant=(id:string|null)=>{meetingService.setFocus(id);if(id)meetingService.setLayout("speaker")};
  const leaveShareLayout=(layout:Extract<MeetingLayoutMode,"grid"|"speaker">)=>{setShareLayoutOverride(true);autoShareLayoutRef.current=false;meetingService.setLayout(layout)};
  const exit=()=>{void meetingService.leave().finally(()=>onExit?.())};
  useEffect(()=>{if(hasScreenShare){if(!shareLayoutOverride&&snapshot.layout!=="screen_share"){previousLayoutRef.current=snapshot.layout;autoShareLayoutRef.current=true;meetingService.setLayout("screen_share")}return}if(autoShareLayoutRef.current){autoShareLayoutRef.current=false;meetingService.setLayout(previousLayoutRef.current);meetingService.setFocus(snapshot.focusedParticipantId,null)}if(shareLayoutOverride)setShareLayoutOverride(false)},[hasScreenShare,shareLayoutOverride,snapshot.focusedParticipantId,snapshot.layout]);
  useEffect(()=>{const context=snapshot.context;if(!context)return;return meetingHostControlService.start(context.roomId,context.sessionId)},[snapshot.context?.roomId,snapshot.context?.sessionId]);
  useEffect(()=>{if((hostState.sessionStatus==="ended"||hostState.roomStatus==="ended"||hostState.roomStatus==="cancelled")&&!['idle','ended'].includes(snapshot.phase))void meetingService.leave()},[hostState.roomStatus,hostState.sessionStatus,snapshot.phase]);
  return <MeetingParticipantActionsProvider snapshot={snapshot}><section className={`meeting-workspace${focusMode?" is-focus-mode":""}${dockOpen?" has-right-dock":""}${admissionOnly?" is-admission-only":""}`} aria-label={snapshot.context?.roomTitle?`${snapshot.context.roomTitle} meeting workspace`:"Picom meeting workspace"}>
    <MeetingTopBar snapshot={snapshot} focusMode={focusMode} onToggleFocus={toggleFocus} onToggleDock={toggleDock} />
    <div className="meeting-workspace__body">
      <main className="meeting-workspace__canvas">
        {admissionOnly?null:snapshot.phase==="prejoin"?<MeetingPreJoin onCancel={exit}/>:<MeetingStage snapshot={snapshot} onFocusParticipant={focusParticipant} onOpenPeople={()=>meetingService.setRightDock("people")} onReturnToGrid={()=>leaveShareLayout("grid")} onReturnToSpeaker={()=>leaveShareLayout("speaker")} />}
        <MeetingWorkspaceStatusSurface snapshot={snapshot} onRetry={()=>{void meetingService.retry()}} onLeave={exit} onCancelWaiting={async()=>{const result=await meetingService.cancelWaitingRequest();return result.ok}} />
      </main>
      {dockOpen?<MeetingRightDock snapshot={snapshot} onSelect={selectDock} onFocusParticipant={focusParticipant} onClose={()=>meetingService.setRightDock("none")} />:null}
    </div>
    {admissionOnly?null:<MeetingControlDock snapshot={snapshot} focusMode={focusMode} onCycleLayout={cycleLayout} onToggleDock={toggleDock} onToggleFocus={toggleFocus} onLeave={exit} />}
  </section></MeetingParticipantActionsProvider>;
}
