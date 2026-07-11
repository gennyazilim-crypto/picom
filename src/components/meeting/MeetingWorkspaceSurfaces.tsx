import { useState } from "react";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";

type WaitingSurfaceState = "waiting" | "admitted" | "denied" | "expired" | "cancelled" | "locked" | "ended";

const waitingCopy: Readonly<Record<WaitingSurfaceState, { icon: "users" | "lock" | "close"; title: string; body: string }>> = {
  waiting: { icon: "users", title: "Waiting for the host", body: "Your identity and request are in the admission queue. Only your own waiting state is visible here." },
  admitted: { icon: "users", title: "You were admitted", body: "Picom is securing your meeting connection now." },
  denied: { icon: "close", title: "Request denied", body: "The host did not admit this request. You can close the workspace safely." },
  expired: { icon: "close", title: "Request expired", body: "The host did not respond before this request expired. You may try joining again." },
  cancelled: { icon: "close", title: "Request cancelled", body: "Your waiting-room request was cancelled and no longer appears to meeting hosts." },
  locked: { icon: "lock", title: "Meeting locked", body: "The host locked this meeting. New admission requests are not currently accepted." },
  ended: { icon: "close", title: "Meeting ended", body: "This meeting is no longer active." },
};

function waitingSurfaceState(snapshot: MeetingClientSnapshot): WaitingSurfaceState | null {
  const providerCode = `${snapshot.error?.providerCode ?? ""} ${snapshot.error?.message ?? ""}`.toLowerCase();
  if (snapshot.phase === "ended" || providerCode.includes("meeting_ended") || providerCode.includes("session ended")) return "ended";
  if (providerCode.includes("locked")) return "locked";
  return snapshot.waitingEntry?.status ?? (snapshot.phase === "waiting" ? "waiting" : null);
}

export function MeetingWorkspaceStatusSurface({snapshot,onRetry,onLeave,onCancelWaiting}:{snapshot:MeetingClientSnapshot;onRetry:()=>void;onLeave:()=>void;onCancelWaiting:()=>Promise<boolean>}) {
  const[cancelling,setCancelling]=useState(false);const[cancelError,setCancelError]=useState("");
  if(snapshot.phase==="connected"||snapshot.phase==="prejoin"||snapshot.phase==="idle")return null;
  if(snapshot.phase==="reconnecting")return <div className="meeting-reconnect-banner" role="status" aria-live="polite"><span className="meeting-status-spinner" aria-hidden="true" />Reconnecting to the meeting. Your layout is preserved.</div>;
  const waitingState=waitingSurfaceState(snapshot);
  const content=waitingState?waitingCopy[waitingState]:snapshot.phase==="token-loading"?{icon:"lock" as const,title:"Authorizing meeting access",body:"Picom is requesting a short-lived meeting credential."}:snapshot.phase==="connecting"?{icon:"voice" as const,title:"Connecting to the media room",body:"Preparing your devices and secure media transport."}:snapshot.phase==="disconnected"?{icon:"volumeOff" as const,title:"Meeting disconnected",body:"Your network or the media room ended the connection."}:{icon:"close" as const,title:"Picom could not open this meeting",body:snapshot.error?.message??"The meeting workspace encountered a fatal connection error."};
  const retry=waitingState==="expired"||(!waitingState&&(snapshot.phase==="failed"||snapshot.phase==="disconnected"));
  const cancel=async()=>{if(cancelling)return;setCancelling(true);setCancelError("");const ok=await onCancelWaiting();if(!ok)setCancelError("Picom could not cancel this request. Try again.");setCancelling(false)};
  const alert=waitingState==="denied"||waitingState==="locked"||waitingState==="ended"||snapshot.phase==="failed";
  return <div className={`meeting-status-surface meeting-status-surface--${waitingState??snapshot.phase}`} role={alert?"alert":"status"} aria-live="polite"><span className="meeting-status-surface__icon"><AppIcon name={content.icon} size="xl" /></span><strong>{content.title}</strong><p>{content.body}</p>{snapshot.error?.message&&waitingState==="denied"?<small>{snapshot.error.message}</small>:null}{cancelError?<small className="meeting-status-surface__error">{cancelError}</small>:null}<div>{retry?<button type="button" onClick={onRetry}>Try again</button>:null}{waitingState==="waiting"?<button type="button" className="secondary" disabled={cancelling} onClick={()=>void cancel()}>{cancelling?"Cancelling...":"Cancel request"}</button>:null}<button type="button" className="secondary" onClick={onLeave}>{waitingState==="waiting"?"Leave workspace":"Close workspace"}</button></div></div>;
}

export function MeetingWorkspaceLoading() {return <section className="meeting-workspace meeting-workspace--loading" aria-label="Loading meeting workspace" aria-busy="true"><span className="meeting-status-spinner" /><strong>Loading meeting workspace</strong></section>}
