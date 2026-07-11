import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";

export function MeetingControlDock({snapshot,focusMode,onToggleMute,onToggleDeafen,onCycleLayout,onToggleDock,onToggleFocus,onLeave}:{snapshot:MeetingClientSnapshot;focusMode:boolean;onToggleMute:()=>void;onToggleDeafen:()=>void;onCycleLayout:()=>void;onToggleDock:()=>void;onToggleFocus:()=>void;onLeave:()=>void}) {
  const connected=snapshot.phase==="connected"||snapshot.phase==="reconnecting";
  return <footer className="meeting-control-dock" aria-label="Meeting controls">
    <div className="meeting-control-dock__cluster">
      <button type="button" className={snapshot.localMedia.muted?"is-off":""} disabled={!connected||!snapshot.capabilities.canPublishAudio} aria-label={snapshot.localMedia.muted?"Unmute microphone":"Mute microphone"} aria-pressed={!snapshot.localMedia.muted} onClick={onToggleMute}><AppIcon name="microphone" size="md" /><span>{snapshot.localMedia.muted?"Unmute":"Mute"}</span></button>
      <button type="button" className={snapshot.localMedia.deafened?"is-off":""} disabled={!connected} aria-label={snapshot.localMedia.deafened?"Restore meeting audio":"Deafen meeting audio"} aria-pressed={snapshot.localMedia.deafened} onClick={onToggleDeafen}><AppIcon name="headphones" size="md" /><span>{snapshot.localMedia.deafened?"Undeafen":"Deafen"}</span></button>
    </div>
    <div className="meeting-control-dock__cluster meeting-control-dock__cluster--center">
      <button type="button" aria-label={`Change meeting layout, current ${snapshot.layout}`} onClick={onCycleLayout}><AppIcon name="maximize" size="md" /><span>{snapshot.layout}</span></button>
      <button type="button" aria-label={snapshot.rightDock==="none"?"Open meeting panel":"Close meeting panel"} aria-pressed={snapshot.rightDock!=="none"} onClick={onToggleDock}><AppIcon name="users" size="md" /><span>People</span></button>
      <button type="button" aria-label={focusMode?"Exit focus mode":"Enter focus mode"} aria-pressed={focusMode} onClick={onToggleFocus}><AppIcon name="eye" size="md" /><span>Focus</span></button>
    </div>
    <div className="meeting-control-dock__cluster meeting-control-dock__cluster--end"><button type="button" className="meeting-control-dock__leave" aria-label="Leave meeting" onClick={onLeave}><AppIcon name="close" size="md" /><span>Leave</span></button></div>
  </footer>;
}
