import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";

export function MeetingWorkspaceStatusSurface({snapshot,onRetry,onLeave}:{snapshot:MeetingClientSnapshot;onRetry:()=>void;onLeave:()=>void}) {
  if(snapshot.phase==="connected"||snapshot.phase==="prejoin"||snapshot.phase==="idle")return null;
  if(snapshot.phase==="reconnecting")return <div className="meeting-reconnect-banner" role="status" aria-live="polite"><span className="meeting-status-spinner" aria-hidden="true" />Reconnecting to the meeting. Your layout is preserved.</div>;
  const content=snapshot.phase==="waiting"?{icon:"users" as const,title:"Waiting for the host",body:"Your request is in the admission queue. You can leave safely while Picom keeps this state current."}:snapshot.phase==="token-loading"?{icon:"lock" as const,title:"Authorizing meeting access",body:"Picom is requesting a short-lived meeting credential."}:snapshot.phase==="connecting"?{icon:"voice" as const,title:"Connecting to the media room",body:"Preparing your devices and secure media transport."}:snapshot.phase==="ended"?{icon:"close" as const,title:"Meeting ended",body:"This meeting is no longer active."}:snapshot.phase==="disconnected"?{icon:"volumeOff" as const,title:"Meeting disconnected",body:"Your network or the media room ended the connection."}:{icon:"close" as const,title:"Picom could not open this meeting",body:snapshot.error?.message??"The meeting workspace encountered a fatal connection error."};
  const retry=snapshot.phase==="failed"||snapshot.phase==="disconnected";
  return <div className={`meeting-status-surface meeting-status-surface--${snapshot.phase}`} role={snapshot.phase==="failed"?"alert":"status"} aria-live="polite"><span className="meeting-status-surface__icon"><AppIcon name={content.icon} size="xl" /></span><strong>{content.title}</strong><p>{content.body}</p><div>{retry?<button type="button" onClick={onRetry}>Try again</button>:null}<button type="button" className="secondary" onClick={onLeave}>{snapshot.phase==="ended"?"Close workspace":"Leave"}</button></div></div>;
}

export function MeetingWorkspaceLoading() {return <section className="meeting-workspace meeting-workspace--loading" aria-label="Loading meeting workspace" aria-busy="true"><span className="meeting-status-spinner" /><strong>Loading meeting workspace</strong></section>}
