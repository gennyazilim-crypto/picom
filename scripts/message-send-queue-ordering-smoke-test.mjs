import fs from "node:fs";

const service = fs.readFileSync("src/services/messageSendQueueService.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const state = fs.readFileSync("src/state/useLocalMessageState.ts", "utf8");
const types = fs.readFileSync("src/types/community.ts", "utf8");
const doc = fs.readFileSync("docs/message-send-queue-ordering.md", "utf8");

const required = [
  service.includes("queues = new Map") ? "" : "queue map",
  service.includes("nextLocalOrder") ? "" : "nextLocalOrder",
  service.includes("previous.then") ? "" : "FIFO chaining",
  service.includes("waitForBrowserOnline") ? "" : "reconnect wait",
  app.includes("messageSendQueueService.enqueue") ? "" : "App queue integration",
  app.includes("localOrder") ? "" : "App localOrder",
  app.includes('localStatus: "queued_offline"') || app.includes('? "queued_offline" : "sending"') ? "" : "optimistic delivery state",
  app.includes("retryFailedMessage") ? "" : "retry recovery",
  state.includes("localOrder") ? "" : "state localOrder",
  types.includes("localOrder?: number") ? "" : "Message localOrder type",
  doc.includes("Failed sends do not permanently block later messages") ? "" : "failure behavior doc",
].filter(Boolean);

if (required.length > 0) {
  console.error(`Message send queue ordering missing: ${required.join(", ")}`);
  process.exit(1);
}

console.log("Message send queue ordering smoke test passed.");
