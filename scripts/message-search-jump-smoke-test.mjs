import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const service = fs.readFileSync("src/services/advancedSearchService.ts", "utf8");
const chatMain = fs.readFileSync("src/components/ChatMain.tsx", "utf8");
const messageList = fs.readFileSync("src/components/MessageList.tsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const doc = fs.readFileSync("docs/search/message-search-jump-production.md", "utf8");

const checks = [
  [app.includes("highlightedMessageId"), "highlight state"],
  [app.includes("jumpToMessage"), "jump handler"],
  [app.includes("resolveMessageJumpTarget"), "click-time target resolution"],
  [app.includes("canViewChannel(access, channel)"), "navigation permission recheck"],
  [service.includes("if (message.deletedAt) continue"), "deleted message exclusion"],
  [service.includes("This message is no longer available or you do not have access."), "safe inaccessible copy"],
  [chatMain.includes("highlightedMessageId"), "ChatMain prop"],
  [messageList.includes("scrollIntoView"), "scroll to message"],
  [messageList.includes("data-message-id"), "message target marker"],
  [css.includes("message-search-highlight"), "highlight CSS"],
  [doc.includes("Context loading"), "documentation"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Message search jump smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Message search result jump smoke passed.");
