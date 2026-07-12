import { lazy, Suspense } from "react";
import { MeetingWorkspaceLoading } from "./MeetingWorkspaceSurfaces";

const LazyMeetingWorkspace=lazy(()=>import("./MeetingWorkspace").then((module)=>({default:module.MeetingWorkspace})));

export function MeetingWorkspaceLazy({onExit,onMinimize}:{onExit?:()=>void;onMinimize?:()=>void}={}){return <Suspense fallback={<MeetingWorkspaceLoading />}><LazyMeetingWorkspace onExit={onExit} onMinimize={onMinimize} /></Suspense>}
export const preloadMeetingWorkspace=()=>import("./MeetingWorkspace");
