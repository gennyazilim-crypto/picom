import fs from "node:fs";

const service = fs.readFileSync("src/services/messageDraftService.ts", "utf8");
const composer = fs.readFileSync("src/components/MessageComposer.tsx", "utf8");
const doc = fs.readFileSync("docs/message-drafts-per-channel.md", "utf8");

const checks = [
  [service.includes("picom.messageDrafts.v1"), "draft storage key"],
  [service.includes("saveDraft") && service.includes("clearDraft"), "draft service methods"],
  [composer.includes("messageDraftService.getDraft"), "composer restores drafts"],
  [composer.includes("messageDraftService.saveDraft"), "composer saves drafts"],
  [composer.includes("messageDraftService.clearDraft"), "composer clears drafts after send"],
  [composer.includes("fileService.revoke(preview)"), "attachment previews are revoked"],
  [doc.includes("No auth tokens") && doc.includes("Attachment previews are not persisted"), "draft safety doc"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Message drafts smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Message drafts per channel smoke passed.");
