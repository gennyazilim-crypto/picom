import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [panel, context, attachments, css] = await Promise.all([
  read("src/components/meeting/MeetingChatPanel.tsx"),
  read("src/services/meeting/meetingChatContextService.ts"),
  read("src/services/attachmentService.ts"),
  read("src/components/meeting/MeetingChatPanel.css"),
]);

for (const primitive of ["listMessages", "sendMessage", "editMessage", "deleteMessage", "addReaction", "removeReaction", "reportMessage", "markRead", "subscribeMessages", "copyDeepLink", "openDeepLink"]) {
  assert.ok(panel.includes(`meetingChatContextService.${primitive}`), `meeting dock does not use ${primitive}`);
}
assert.ok(panel.includes("replyToMessageId") && panel.includes("attachmentIds"), "composer does not persist reply and attachment context");
assert.ok(panel.includes("ImagePreviewModal") && panel.includes("fileService.pickImages"), "attachment picker/preview integration missing");
assert.ok(panel.includes("noopener noreferrer") && !panel.includes("dangerouslySetInnerHTML"), "safe link contract missing");
assert.ok(panel.includes("context?.canWrite") && panel.includes("snapshot.capabilities.canSendChat"), "guest/member write gate missing");
assert.ok(panel.includes("confirmDeleteId") && panel.includes("expectedEditedAt"), "safe edit/delete conflict handling missing");
assert.ok(!/supabase|livekit/i.test(panel), "meeting UI bypasses service boundaries");
for (const canonical of ["messageService.listMessages", "messageService.sendMessage", "messageService.editMessage", "messageService.deleteMessage", "reactionService.addReaction", "reactionService.removeReaction", "reportService.submitReport"]) assert.ok(context.includes(canonical), `context adapter does not reuse ${canonical}`);
assert.ok(context.includes("deepLinkService.handleDeepLink") && context.includes("createMeetingChatDeepLink"), "exact source/message deep link dispatch missing");
assert.ok(attachments.includes('from("attachments")') && attachments.includes("createSignedUrl") && attachments.includes("scan_status"), "private attachment RLS/signed display path missing");
assert.ok(css.includes(".meeting-chat-panel-v2") && css.includes("minmax(0,1fr)") && css.includes(".meeting-chat-attachments"), "narrow desktop dock layout missing");
assert.ok(!context.includes("meetingMessages =") && !context.includes("localStorage"), "a second meeting chat store was introduced");
console.log("Meeting chat Full MVP UI, canonical persistence, permissions, attachments, and deep-link smoke: PASS");
