import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const workspace=read("src/components/meeting/MeetingWorkspace.tsx"),top=read("src/components/meeting/MeetingTopBar.tsx"),stage=read("src/components/meeting/MeetingStage.tsx"),dock=read("src/components/meeting/MeetingRightDock.tsx"),controls=read("src/components/meeting/MeetingControlDock.tsx"),navigation=read("src/components/meeting/MeetingAccessibilityNavigation.tsx"),surfaces=read("src/components/meeting/MeetingWorkspaceSurfaces.tsx"),lazy=read("src/components/meeting/MeetingWorkspaceLazy.tsx"),css=read("src/components/meeting/MeetingWorkspace.css");
for(const component of ["MeetingWorkspace","MeetingTopBar","MeetingStage","MeetingRightDock","MeetingControlDock"])assert.ok([workspace,top,stage,dock,controls].some((source)=>source.includes(`function ${component}`)),`missing ${component}`);
for(const phase of ["waiting","token-loading","connecting","reconnecting","ended","failed"])assert.ok(surfaces.includes(phase),`missing ${phase} surface`);
assert.ok(lazy.includes("lazy(()=>import")&&lazy.includes("Suspense"),"workspace must be lazy loaded");
for(const marker of ["min-width:0","min-height:0","overflow:hidden","grid-template-columns:minmax(0,1fr)","is-focus-mode","has-right-dock"])assert.ok(css.includes(marker),`missing layout contract ${marker}`);
assert.ok(!css.match(/@media\s*\([^)]*max-width/i)&&!css.includes("position:fixed"),"workspace must remain desktop-contained without mobile breakpoint or global overlay");
for(const target of ["meeting-media-stage","meeting-control-dock","meeting-side-panel"])assert.ok(workspace.includes(target)||controls.includes(target)||dock.includes(target),`missing focus target ${target}`);
assert.ok(workspace.includes("tabIndex={-1}")&&dock.includes("tabIndex={-1}")&&controls.includes("tabIndex={-1}")&&navigation.includes("Skip to meeting stage"),"structural regions must support skip navigation without extra tab stops");
assert.ok(!workspace.includes("getSupabaseClient")&&!workspace.includes("livekit-client"),"workspace must consume state/actions, not providers");
console.log("Meeting workspace shell, stage, right dock, controls, states, focus mode, lazy boundary, and overflow contracts: PASS");
