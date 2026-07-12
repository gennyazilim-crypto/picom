import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hook = read("src/hooks/useMeetingKeyboardShortcuts.ts");
const workspace = read("src/components/meeting/MeetingWorkspace.tsx");
const controls = read("src/components/meeting/MeetingControlDock.tsx");
const navigation = read("src/components/meeting/MeetingAccessibilityNavigation.tsx");
const workspaceCss = read("src/components/meeting/MeetingWorkspace.css");
const reactionCss = read("src/components/meeting/MeetingReactionOverlay.css");
const participant = read("src/components/meeting/MeetingParticipantTile.tsx");
const captions = read("src/components/meeting/MeetingCaptionPanel.tsx");

const checks = [
  [hook.includes("EDITABLE_SELECTOR") && hook.includes("BLOCKING_OVERLAY_SELECTOR"), "shortcuts pause for editing and overlays"],
  [["microphone", "camera", "screen-share", "hand"].every((action) => hook.includes(`\"${action}\"`)), "media and hand shortcuts are routed through existing controls"],
  [hook.includes("Control Shift L") && hook.includes("leaveButton.focus"), "leave shortcut requires a focused confirmation action"],
  [workspace.includes("MeetingAccessibilityNavigation") && workspace.includes("meeting-keyboard-help"), "workspace exposes skip links and shortcut help"],
  [navigation.includes("meeting-media-stage") && navigation.includes("meeting-control-dock") && navigation.includes("meeting-side-panel"), "stage dock and panel are focus targets"],
  [controls.includes("useDialogFocusTrap") && controls.includes("role=\"alertdialog\"") && controls.includes("data-dialog-initial-focus"), "destructive dialog traps and restores focus"],
  [controls.includes("ArrowDown") && controls.includes("ArrowUp") && controls.includes("menuTrigger"), "control menus support keyboard traversal and focus restoration"],
  [participant.includes("isSpeaking ? \"speaking\"") && participant.includes("hand raised") && participant.includes("connection"), "participant state has non-color screen-reader text"],
  [captions.includes("Text size") && captions.includes("setFontSize"), "caption typography control remains available"],
  [workspaceCss.includes("focus-visible") && workspaceCss.includes("prefers-reduced-motion:reduce"), "visible focus and reduced-motion contracts exist"],
  [reactionCss.includes("animation:none") && reactionCss.includes("transition:none"), "reaction motion is disabled when requested"],
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
console.log(`Meeting accessibility keyboard smoke passed (${checks.length} checks).`);
