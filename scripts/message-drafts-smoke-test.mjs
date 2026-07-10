import fs from "node:fs";
const service=fs.readFileSync("src/services/messageDraftService.ts","utf8");const composer=fs.readFileSync("src/components/MessageComposer.tsx","utf8");const dm=fs.readFileSync("src/components/DirectMessagesView.tsx","utf8");const doc=fs.readFileSync("docs/message-drafts-per-channel.md","utf8");
const checks=[
  [service.includes("picom.messageDrafts.v1"),"draft storage key"],
  [service.includes('mode: "local_only"')&&service.includes("remoteEnabled: false"),"remote sync fail closed"],
  [service.includes("resolveDraftConflict")&&service.includes("localTime >= remoteTime"),"conflict policy"],
  [service.includes("community:${context.communityId}:channel:${context.channelId}")&&service.includes("dm:${context.directConversationId}"),"channel and DM keys"],
  [composer.includes("messageDraftService.clearDraft")&&dm.includes("messageDraftService.clearDraft"),"clear after send"],
  [composer.includes("fileService.revoke(preview)"),"attachment previews revoked"],
  [doc.includes("No auth tokens")&&doc.includes("Never sync files")&&doc.includes("conflict"),"privacy and conflict docs"]
];
const failed=checks.filter(([ok])=>!ok).map(([,label])=>label);if(failed.length){console.error(`Message drafts smoke failed: ${failed.join(", ")}`);process.exit(1);}console.log("Message drafts local-only sync policy smoke passed.");
