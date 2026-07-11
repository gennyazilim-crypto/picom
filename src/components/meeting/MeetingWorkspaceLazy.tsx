import { lazy, Suspense } from "react";
import { MeetingWorkspaceLoading } from "./MeetingWorkspaceSurfaces";

const LazyMeetingWorkspace=lazy(()=>import("./MeetingWorkspace").then((module)=>({default:module.MeetingWorkspace})));

export function MeetingWorkspaceLazy({onExit}:{onExit?:()=>void}={}){return <Suspense fallback={<MeetingWorkspaceLoading />}><LazyMeetingWorkspace onExit={onExit} /></Suspense>}
export const preloadMeetingWorkspace=()=>import("./MeetingWorkspace");
