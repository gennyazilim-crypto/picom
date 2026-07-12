import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { MeetingLayoutMenu } from "./MeetingLayoutMenu";

const labels: Record<MeetingClientSnapshot["phase"], string> = {
  idle:"Idle",prejoin:"Ready to join",waiting:"Waiting for host","token-loading":"Authorizing",connecting:"Connecting",connected:"Connected",reconnecting:"Reconnecting",disconnected:"Disconnected",ended:"Ended",failed:"Connection failed",
};

export function MeetingTopBar({snapshot,focusMode,onToggleFocus,onToggleDock,onMinimize}:{snapshot:MeetingClientSnapshot;focusMode:boolean;onToggleFocus:()=>void;onToggleDock:()=>void;onMinimize?:()=>void}) {
  const participantCount=snapshot.participantIds.length;
  return <header className="meeting-top-bar">
    <div className="meeting-top-bar__identity"><span className="meeting-top-bar__mark" aria-hidden="true"><AppIcon name="voice" size="md" /></span><span><small>Picom meeting</small><strong>{snapshot.context?.roomTitle??"Meeting workspace"}</strong></span></div>
    <div className={`meeting-status-chip meeting-status-chip--${snapshot.phase}`} role="status" aria-live="polite"><i aria-hidden="true" />{labels[snapshot.phase]}</div>
    <div className="meeting-top-bar__meta"><span><AppIcon name="users" size="xs" />{participantCount}</span>{snapshot.role?<span>{snapshot.role}</span>:null}</div>
    <div className="meeting-top-bar__actions">
      <MeetingLayoutMenu snapshot={snapshot} />
      {onMinimize?<button type="button" aria-label="Keep meeting connected and return to Picom" onClick={onMinimize}><AppIcon name="minimize" size="sm" /></button>:null}
      <button type="button" aria-label={focusMode?"Exit meeting focus mode":"Enter meeting focus mode"} aria-pressed={focusMode} onClick={onToggleFocus}><AppIcon name={focusMode?"minimize":"maximize"} size="sm" /></button>
      <button type="button" aria-label={snapshot.rightDock==="none"?"Open meeting side panel":"Close meeting side panel"} aria-pressed={snapshot.rightDock!=="none"} onClick={onToggleDock}><AppIcon name="users" size="sm" /></button>
    </div>
  </header>;
}
