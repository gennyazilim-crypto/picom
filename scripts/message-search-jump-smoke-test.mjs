import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const chatMain = fs.readFileSync("src/components/ChatMain.tsx", "utf8");
const messageList = fs.readFileSync("src/components/MessageList.tsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const doc = fs.readFileSync("docs/message-search-result-jump.md", "utf8");

const checks = [
  [app.includes("highlightedMessageId"), "highlight state"],
  [app.includes("jumpToMessage"), "jump handler"],
  [app.includes("Opened message in channel."), "user feedback"],
  [chatMain.includes("highlightedMessageId"), "ChatMain prop"],
  [messageList.includes("scrollIntoView"), "scroll to message"],
  [messageList.includes("data-message-id"), "message target marker"],
  [css.includes("message-search-highlight"), "highlight CSS"],
  [doc.includes("Command Palette"), "documentation"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Message search jump smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Message search result jump smoke passed.");
