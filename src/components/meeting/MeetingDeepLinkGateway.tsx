import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { deepLinkService } from "../../services/deepLinkService";
import type { MeetingInviteNavigationSnapshot } from "../../services/meeting/meetingInviteNavigationService";
import { AppIcon } from "../AppIcon";
import { MeetingWorkspaceLazy } from "./MeetingWorkspaceLazy";
import { MeetingJoinPreviewCard } from "./MeetingJoinPreviewCard";
import "./MeetingDeepLinkGateway.css";

const LazyConnectedMeetingMiniCard=lazy(()=>import("./ConnectedMeetingMiniCard").then((module)=>({default:module.ConnectedMeetingMiniCard})));

export function MeetingDeepLinkGateway() {
  const [state, setState] = useState<MeetingInviteNavigationSnapshot>({ status: "idle", preview: null, message: "" });
  const [minimized, setMinimized] = useState(false);
  const serviceRef = useRef<(typeof import("../../services/meeting/meetingInviteNavigationService"))["meetingInviteNavigationService"] | null>(null);
  const meetingServiceRef = useRef<(typeof import("../../services/meeting/meetingService"))["meetingService"] | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const operationRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    const detach = deepLinkService.onDeepLink((action) => {
      if (action.type !== "meeting") return;
      const operation = ++operationRef.current;
      setState({ status: "loading", preview: null, message: "Checking meeting access..." });
      void Promise.all([import("../../services/meeting/meetingInviteNavigationService"),import("../../services/meeting/meetingService")]).then(([{ meetingInviteNavigationService },{ meetingService }]) => {
        if (!mounted || operation !== operationRef.current) return;
        meetingServiceRef.current=meetingService;
        const active=meetingService.store.getSnapshot();
        if(active.context&&!["idle","ended"].includes(active.phase)){
          if(active.context.roomId===action.roomId&&(!action.sessionId||active.context.sessionId===action.sessionId)){setMinimized(false);setState({status:"open",preview:null,message:"Returned to the active meeting."});return}
          setMinimized(false);setState({status:"open",preview:null,message:"Leave the active meeting before joining another."});return;
        }
        unsubscribeRef.current?.();
        serviceRef.current = meetingInviteNavigationService;
        const sync = () => { if (mounted && operation === operationRef.current) setState(meetingInviteNavigationService.getSnapshot()); };
        unsubscribeRef.current = meetingInviteNavigationService.subscribe(sync);
        sync();
        setMinimized(false);void meetingInviteNavigationService.open(action);
      }).catch(() => { if (mounted && operation === operationRef.current) setState({ status: "error", preview: null, message: "Picom could not load the meeting link experience." }); });
    });
    const minimizeForNavigation=()=>setMinimized(true);window.addEventListener("picom:meeting-participant-navigation",minimizeForNavigation);
    const shutdown=()=>{void meetingServiceRef.current?.leave()};window.addEventListener("beforeunload",shutdown);
    return () => { mounted = false; detach(); unsubscribeRef.current?.(); unsubscribeRef.current = null; window.removeEventListener("picom:meeting-participant-navigation",minimizeForNavigation);window.removeEventListener("beforeunload",shutdown);document.body.classList.remove("picom-meeting-connected"); };
  }, []);
  useEffect(()=>{document.body.classList.toggle("picom-meeting-connected",state.status==="open");return()=>document.body.classList.remove("picom-meeting-connected")},[state.status]);
  const dismiss = () => { operationRef.current += 1; unsubscribeRef.current?.(); unsubscribeRef.current = null; serviceRef.current?.dismiss(); serviceRef.current = null; meetingServiceRef.current=null;setMinimized(false);setState({ status: "idle", preview: null, message: "" }); };
  const leave=()=>{const service=meetingServiceRef.current;if(service)void service.leave().finally(dismiss);else dismiss()};
  if (state.status === "idle") return null;
  if (state.status === "open") return <>{!minimized?<div className="meeting-deep-link-workspace"><MeetingWorkspaceLazy onExit={dismiss} onMinimize={()=>setMinimized(true)} /></div>:null}{minimized?<Suspense fallback={null}><LazyConnectedMeetingMiniCard onReturn={()=>setMinimized(false)} onLeave={leave}/></Suspense>:null}</>;
  return <div className="meeting-deep-link-gateway" role={state.status === "error" ? "alertdialog" : "status"} aria-modal="true" aria-label="Meeting link preview"><div>{state.status === "loading" ? <><span className="meeting-status-spinner" aria-hidden="true"/><strong>Checking meeting access</strong><p>Picom is validating this link without exposing its invite credential.</p></> : <><span className="meeting-deep-link-gateway__icon"><AppIcon name="lock" size="lg"/></span><strong>Meeting unavailable</strong>{state.preview ? <MeetingJoinPreviewCard preview={state.preview} message={state.message}/> : <p>{state.message}</p>}<button type="button" onClick={dismiss}>Close</button></>}</div></div>;
}
