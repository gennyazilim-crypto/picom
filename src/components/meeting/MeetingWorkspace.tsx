import { useState, useSyncExternalStore } from "react";
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
  const dockOpen=snapshot.rightDock!=="none"&&!focusMode;
  const toggleDock=()=>meetingService.setRightDock(snapshot.rightDock==="none"?"people":"none");
  const selectDock=(panel:MeetingSidePanel)=>meetingService.setRightDock(panel);
  const cycleLayout=()=>meetingService.setLayout(layouts[(layouts.indexOf(snapshot.layout)+1)%layouts.length]);
  const toggleFocus=()=>setFocusMode((current)=>!current);
  return <section className={`meeting-workspace${focusMode?" is-focus-mode":""}${dockOpen?" has-right-dock":""}`} aria-label={snapshot.context?.roomTitle?`${snapshot.context.roomTitle} meeting workspace`:"Picom meeting workspace"}>
    <MeetingTopBar snapshot={snapshot} focusMode={focusMode} onToggleFocus={toggleFocus} onToggleDock={toggleDock} />
    <div className="meeting-workspace__body">
      <main className="meeting-workspace__canvas">
        {snapshot.phase==="prejoin"?<MeetingPreJoin />:<MeetingStage snapshot={snapshot} onFocusParticipant={(id)=>meetingService.setFocus(id)} />}
        <MeetingWorkspaceStatusSurface snapshot={snapshot} onRetry={()=>{void meetingService.retry()}} onLeave={()=>{void meetingService.leave()}} />
      </main>
      {dockOpen?<MeetingRightDock snapshot={snapshot} onSelect={selectDock} onClose={()=>meetingService.setRightDock("none")} />:null}
    </div>
    <MeetingControlDock snapshot={snapshot} focusMode={focusMode} onToggleMute={()=>{void meetingService.setMuted(!snapshot.localMedia.muted)}} onToggleDeafen={()=>meetingService.setDeafened(!snapshot.localMedia.deafened)} onCycleLayout={cycleLayout} onToggleDock={toggleDock} onToggleFocus={toggleFocus} onLeave={()=>{void meetingService.leave()}} />
  </section>;
}
