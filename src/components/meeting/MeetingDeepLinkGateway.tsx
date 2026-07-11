import { useEffect, useRef, useState } from "react";
import { deepLinkService } from "../../services/deepLinkService";
import type { MeetingInviteNavigationSnapshot } from "../../services/meeting/meetingInviteNavigationService";
import { AppIcon } from "../AppIcon";
import { MeetingWorkspaceLazy } from "./MeetingWorkspaceLazy";
import { MeetingJoinPreviewCard } from "./MeetingJoinPreviewCard";
import "./MeetingDeepLinkGateway.css";

export function MeetingDeepLinkGateway() {
  const [state, setState] = useState<MeetingInviteNavigationSnapshot>({ status: "idle", preview: null, message: "" });
  const serviceRef = useRef<(typeof import("../../services/meeting/meetingInviteNavigationService"))["meetingInviteNavigationService"] | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const operationRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    const detach = deepLinkService.onDeepLink((action) => {
      if (action.type !== "meeting") return;
      const operation = ++operationRef.current;
      setState({ status: "loading", preview: null, message: "Checking meeting access..." });
      void import("../../services/meeting/meetingInviteNavigationService").then(({ meetingInviteNavigationService }) => {
        if (!mounted || operation !== operationRef.current) return;
        unsubscribeRef.current?.();
        serviceRef.current = meetingInviteNavigationService;
        const sync = () => { if (mounted && operation === operationRef.current) setState(meetingInviteNavigationService.getSnapshot()); };
        unsubscribeRef.current = meetingInviteNavigationService.subscribe(sync);
        sync();
        void meetingInviteNavigationService.open(action);
      }).catch(() => { if (mounted && operation === operationRef.current) setState({ status: "error", preview: null, message: "Picom could not load the meeting link experience." }); });
    });
    return () => { mounted = false; detach(); unsubscribeRef.current?.(); unsubscribeRef.current = null; };
  }, []);
  const dismiss = () => { operationRef.current += 1; unsubscribeRef.current?.(); unsubscribeRef.current = null; serviceRef.current?.dismiss(); serviceRef.current = null; setState({ status: "idle", preview: null, message: "" }); };
  if (state.status === "idle") return null;
  if (state.status === "open") return <div className="meeting-deep-link-workspace"><MeetingWorkspaceLazy onExit={dismiss} /></div>;
  return <div className="meeting-deep-link-gateway" role={state.status === "error" ? "alertdialog" : "status"} aria-modal="true" aria-label="Meeting link preview"><div>{state.status === "loading" ? <><span className="meeting-status-spinner" aria-hidden="true"/><strong>Checking meeting access</strong><p>Picom is validating this link without exposing its invite credential.</p></> : <><span className="meeting-deep-link-gateway__icon"><AppIcon name="lock" size="lg"/></span><strong>Meeting unavailable</strong>{state.preview ? <MeetingJoinPreviewCard preview={state.preview} message={state.message}/> : <p>{state.message}</p>}<button type="button" onClick={dismiss}>Close</button></>}</div></div>;
}
