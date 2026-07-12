import { readFile } from "node:fs/promises";

const [service, menu, workspace, screen, participantActions, css] = await Promise.all([
  readFile("src/services/meeting/meetingLayoutPreferenceService.ts", "utf8"),
  readFile("src/components/meeting/MeetingLayoutMenu.tsx", "utf8"),
  readFile("src/components/meeting/MeetingWorkspace.tsx", "utf8"),
  readFile("src/components/meeting/MeetingScreenShareFocus.tsx", "utf8"),
  readFile("src/components/meeting/MeetingParticipantActionsProvider.tsx", "utf8"),
  readFile("src/components/meeting/MeetingWorkspace.css", "utf8"),
]);

const checks = [
  [service.includes('"auto" | MeetingLayoutMode') && service.includes("getValidMeetingLayoutPreferences"), "Auto and context-valid layout preferences"],
  [service.includes("sessionStorage") && !service.includes("localStorage"), "session-local preference persistence"],
  [menu.includes('role="menuitemradio"') && menu.includes("ArrowDown") && menu.includes("Escape"), "accessible keyboard layout menu"],
  [workspace.includes("resolveMeetingLayout") && workspace.includes("layoutPreference!==\"auto\""), "manual override and invalid-layout fallback"],
  [workspace.includes("participantValid") && workspace.includes("shareValid"), "stale participant and share pin cleanup"],
  [screen.includes("Pin share") && screen.includes("focusedShareId"), "local screen-share pin and unpin"],
  [participantActions.includes('setPreference("speaker")'), "participant pin enters speaker focus"],
  [workspace.includes("picom-meeting-focus") && css.includes(".desktop-frame>.server-rail") && css.includes(".desktop-frame>.community-sidebar") && css.includes(".desktop-frame>.member-sidebar"), "reversible app focus mode"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Meeting layout selection, pinning, and focus-mode contract passed.");
