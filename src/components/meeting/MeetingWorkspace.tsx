import { useEffect, useState, useSyncExternalStore } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import { meetingHostControlService } from "../../services/meeting/meetingHostControlService";
import { getValidMeetingLayoutPreferences, meetingLayoutPreferenceService, resolveMeetingLayout } from "../../services/meeting/meetingLayoutPreferenceService";
import type { MeetingLayoutMode, MeetingSidePanel } from "../../types/meeting";
import { MeetingControlDock } from "./MeetingControlDock";
import { MeetingPreJoin } from "./MeetingPreJoin";
import { MeetingRightDock } from "./MeetingRightDock";
import { MeetingStage } from "./MeetingStage";
import { MeetingTopBar } from "./MeetingTopBar";
import { MeetingWorkspaceStatusSurface } from "./MeetingWorkspaceSurfaces";
import { MeetingParticipantActionsProvider } from "./MeetingParticipantActionsProvider";
import "./MeetingWorkspace.css";

export function MeetingWorkspace({onExit,onMinimize}:{onExit?:()=>void;onMinimize?:()=>void}={}) {
  const snapshot=useSyncExternalStore(meetingService.store.subscribe,meetingService.store.getSnapshot,meetingService.store.getSnapshot);
  const hostState=useSyncExternalStore(meetingHostControlService.subscribe,meetingHostControlService.getSnapshot,meetingHostControlService.getSnapshot);
  const layoutPreference=useSyncExternalStore(meetingLayoutPreferenceService.subscribe,meetingLayoutPreferenceService.getSnapshot,meetingLayoutPreferenceService.getSnapshot).preference;
  const [focusMode,setFocusMode]=useState(false);
  const admissionOnly=Boolean(snapshot.waitingEntry&&snapshot.waitingEntry.status!=="admitted"&&snapshot.phase!=="connected");
  const dockOpen=snapshot.rightDock!=="none"&&!focusMode&&!admissionOnly;
  const toggleDock=()=>meetingService.setRightDock(snapshot.rightDock==="none"?"people":"none");
  const selectDock=(panel:MeetingSidePanel)=>meetingService.setRightDock(panel);
  const cycleLayout=()=>{const options=getValidMeetingLayoutPreferences(snapshot),index=options.indexOf(layoutPreference),next=options[(index+1)%options.length]??"auto";meetingLayoutPreferenceService.setPreference(next)};
  const toggleFocus=()=>setFocusMode((current)=>!current);
  const focusParticipant=(id:string|null)=>{meetingService.setFocus(id,snapshot.focusedShareId);if(id)meetingLayoutPreferenceService.setPreference("speaker")};
  const leaveShareLayout=(layout:Extract<MeetingLayoutMode,"grid"|"speaker">)=>meetingLayoutPreferenceService.setPreference(layout);
  const exit=()=>{document.body.classList.remove("picom-meeting-focus");void meetingService.leave().finally(()=>onExit?.())};
  useEffect(()=>{const roomId=snapshot.context?.roomId;if(roomId)meetingLayoutPreferenceService.activate(roomId)},[snapshot.context?.roomId]);
  useEffect(()=>{const valid=getValidMeetingLayoutPreferences(snapshot);if(layoutPreference!=="auto"&&!valid.includes(layoutPreference)){meetingLayoutPreferenceService.reset();return}const resolved=resolveMeetingLayout(snapshot,layoutPreference);if(snapshot.layout!==resolved)meetingService.setLayout(resolved)},[layoutPreference,snapshot.context?.roomMode,snapshot.layout,snapshot.participantIds.length,snapshot.screenShares]);
  useEffect(()=>{const participantValid=!snapshot.focusedParticipantId||snapshot.participantIds.includes(snapshot.focusedParticipantId),shareValid=!snapshot.focusedShareId||(snapshot.screenShares??[]).some((share)=>share.id===snapshot.focusedShareId);if(!participantValid||!shareValid)meetingService.setFocus(participantValid?snapshot.focusedParticipantId:null,shareValid?snapshot.focusedShareId:null)},[snapshot.focusedParticipantId,snapshot.focusedShareId,snapshot.participantIds,snapshot.screenShares]);
  useEffect(()=>{document.body.classList.toggle("picom-meeting-focus",focusMode);const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&focusMode){event.preventDefault();setFocusMode(false)}};document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);document.body.classList.remove("picom-meeting-focus")}},[focusMode]);
  useEffect(()=>{const context=snapshot.context;if(!context)return;return meetingHostControlService.start(context.roomId,context.sessionId)},[snapshot.context?.roomId,snapshot.context?.sessionId]);
  useEffect(()=>{if((hostState.sessionStatus==="ended"||hostState.roomStatus==="ended"||hostState.roomStatus==="cancelled")&&!['idle','ended'].includes(snapshot.phase))void meetingService.leave()},[hostState.roomStatus,hostState.sessionStatus,snapshot.phase]);
  return <MeetingParticipantActionsProvider snapshot={snapshot}><section className={`meeting-workspace${focusMode?" is-focus-mode":""}${dockOpen?" has-right-dock":""}${admissionOnly?" is-admission-only":""}`} aria-label={snapshot.context?.roomTitle?`${snapshot.context.roomTitle} meeting workspace`:"Picom meeting workspace"}>
    <MeetingTopBar snapshot={snapshot} focusMode={focusMode} onToggleFocus={toggleFocus} onToggleDock={toggleDock} onMinimize={onMinimize} />
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
