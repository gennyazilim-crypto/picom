import { readFileSync } from "node:fs";

const component = readFileSync("src/components/DirectMessagesView.tsx", "utf8");
const styles = readFileSync("src/components/DirectMessagesView.css", "utf8");

for (const marker of ["DirectMessageGroup", "groupDirectMessages", "direct-message-stack", "details-open", "ImagePreviewModal", "aria-pressed={detailsOpen}"]) {
  if (!component.includes(marker)) throw new Error(`DM layout component marker missing: ${marker}`);
}
for (const marker of ["grid-template-columns: minmax(260px, 280px) minmax(0, 1fr) 312px", "max-width: 880px", "justify-content: flex-end", "@media (max-width: 1320px)", ".direct-messages-view.details-open .dm-details-panel", "overflow: hidden", "min-height: 100%"] ) {
  if (!styles.includes(marker)) throw new Error(`DM layout style marker missing: ${marker}`);
}
if (/supabase\.from|dangerouslySetInnerHTML/.test(component)) throw new Error("DM view must not bypass services or render unsafe HTML.");
if (!component.includes('size={compact ? "compact" : "medium"}') || component.includes('size="profile"')) throw new Error("DM avatars must use compact/medium non-aura verification variants only.");
if (!component.includes("aria-expanded={detailsOpen}")) throw new Error("DM details disclosure state must be accessible.");

console.log("Direct Messages centered desktop layout and grouping smoke passed.");
