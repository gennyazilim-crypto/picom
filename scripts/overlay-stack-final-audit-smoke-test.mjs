import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const state = read("src/state/useOverlayState.ts");
const app = read("src/App.tsx");
const focusTrap = read("src/hooks/useDialogFocusTrap.ts");
const communityMenu = read("src/components/CommunityMenu.tsx");
const imagePreview = read("src/components/ImagePreviewModal.tsx");
const settings = read("src/components/SettingsModal.tsx");
const stories = read("src/components/FollowedPeopleStoriesHeader.tsx");
const contextMenu = read("src/components/DesktopContextMenu.tsx");
const profile = read("src/components/UserProfilePopover.tsx");
const styles = read("src/styles.css");
const docs = read("docs/ui-overlay-state.md");

for (const marker of ["openSettings", "openPalette", "openContextMenu", "openProfile", "openPreview", "setMenu(null)", "setProfile(null)", "setPreview(null)", "setPaletteOpen(false)"])
  assert(state.includes(marker), `Overlay state conflict handling is missing ${marker}`);

for (const marker of ["externalBlockingOverlayOpen", "closeTransientOverlays()", "createCommunityOpen", "reportTarget", "crashRecoveryRecord", "isAppLocked"])
  assert(app.includes(marker), `External blocking overlay cleanup is missing ${marker}`);

for (const marker of ["isTopmostDialog", 'event.key === "Escape"', "previousFocus?.focus()", "contains(document.activeElement)"])
  assert(focusTrap.includes(marker), `Topmost focus/Escape contract is missing ${marker}`);

for (const [label, source] of [["Community access modal", communityMenu], ["Image preview", imagePreview], ["Settings", settings], ["Story viewer", stories]]) {
  assert(source.includes("useDialogFocusTrap"), `${label} must use the shared dialog focus trap`);
}

for (const [label, source] of [["Context menu", contextMenu], ["Profile popover", profile]]) {
  assert(source.includes("previousFocus"), `${label} must restore focus`);
  assert(source.includes("clampOverlayPosition"), `${label} must stay in viewport bounds`);
}

assert(styles.includes("html,body,#root{height:100%;margin:0;overflow:hidden}"), "Page-level background scroll lock is missing");
assert(styles.includes(".modal-backdrop") && styles.includes("position:fixed;inset:0"), "Blocking modal backdrop contract is missing");

for (const marker of ["topmost", "focus restoration", "background scroll", "context menu", "story viewer", "manual"])
  assert(docs.toLowerCase().includes(marker), `Overlay audit documentation is missing ${marker}`);

console.log("Overlay stack final structural audit passed.");
