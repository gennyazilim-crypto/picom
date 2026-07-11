import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hook = read("src/hooks/useDialogFocusTrap.ts");
for (const marker of ["isTopmostDialog", "[data-dialog-initial-focus], [autofocus]", "contains(document.activeElement)", "previousFocus?.focus()"])
  assert(hook.includes(marker), `Focus trap is missing ${marker}`);
const modalFiles = ["src/components/ChannelManagementModals.tsx", "src/components/CommunityInviteModals.tsx", "src/components/CreateChannelModal.tsx", "src/components/CreateCommunityModal.tsx", "src/components/CreatePollModal.tsx", "src/components/DeveloperPortalView.tsx", "src/components/StoryViewerModal.tsx", "src/components/MemberModerationModal.tsx", "src/components/ReportModal.tsx", "src/components/feedback/FeedbackModal.tsx"];
for (const path of modalFiles) { const source = read(path); assert(source.includes("useDialogFocusTrap"), `${path} must use the shared dialog focus trap`); assert(source.includes('aria-modal="true"'), `${path} must expose modal semantics`); assert(source.includes("tabIndex={-1}"), `${path} must provide a programmatic focus fallback`); }
const icon = read("src/components/AppIcon.tsx");
assert(icon.includes("aria-hidden={ariaLabel ? undefined : true}"), "Decorative AppIcon instances must be hidden from screen readers");
assert(icon.includes('focusable="false"'), "AppIcon must not enter keyboard focus order");
for (const path of ["src/components/WindowTitleBar.tsx", "src/components/ServerRail.tsx", "src/components/ChatHeader.tsx", "src/components/MessageComposer.tsx"]) assert(read(path).includes("aria-label"), `${path} must label icon controls`);
const styles = read("src/styles.css");
assert(styles.includes(":where(button, input, select, textarea, a[href], [tabindex]):focus-visible"), "Global focus-visible token path is missing");
assert(styles.includes('data-high-contrast="true"'), "High-contrast token path is missing");
assert(styles.includes('data-focus-ring-strong="true"'), "Strong focus ring token path is missing");
const checklist = read("docs/accessibility-remediation-checklist.md");
for (const marker of ["Windows Narrator", "Linux Orca", "macOS VoiceOver", "Keyboard-only", "Contrast", "No conformance claim"]) assert(checklist.includes(marker), `Accessibility checklist is missing ${marker}`);
console.log("Accessibility remediation structural smoke test passed.");
