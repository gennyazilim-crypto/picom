import { lazy, Suspense } from "react";
import { MeetingWorkspaceLoading } from "./MeetingWorkspaceSurfaces";

const LazyMeetingWorkspace=lazy(()=>import("./MeetingWorkspace").then((module)=>({default:module.MeetingWorkspace})));

export function MeetingWorkspaceLazy(){return <Suspense fallback={<MeetingWorkspaceLoading />}><LazyMeetingWorkspace /></Suspense>}
export const preloadMeetingWorkspace=()=>import("./MeetingWorkspace");
