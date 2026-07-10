import { readFileSync } from "node:fs";

const component = readFileSync("src/components/DirectMessagesView.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

for (const marker of ["DirectMessageGroup", "groupDirectMessages", "direct-message-stack", "details-open", "ImagePreviewModal", "aria-pressed={detailsOpen}"]) {
  if (!component.includes(marker)) throw new Error(`DM layout component marker missing: ${marker}`);
}
for (const marker of ["grid-template-columns:minmax(260px,280px) minmax(0,1fr) 312px", "max-width:880px", "justify-content:flex-end", "@media (max-width:1320px)", ".direct-messages-view.details-open .dm-details-panel"]) {
  if (!styles.includes(marker)) throw new Error(`DM layout style marker missing: ${marker}`);
}
if (/supabase\.from|dangerouslySetInnerHTML/.test(component)) throw new Error("DM view must not bypass services or render unsafe HTML.");

console.log("Direct Messages centered desktop layout and grouping smoke passed.");
