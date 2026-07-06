import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  safety: "src/services/userSafetyCenterService.ts",
  app: "src/App.tsx",
  chatMain: "src/components/ChatMain.tsx",
  messageList: "src/components/MessageList.tsx",
  messageItem: "src/components/MessageItem.tsx",
  styles: "src/styles.css",
  docs: "docs/read-receipts-placeholder.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  safety: ["enableReadReceipts", "subscribe(listener", "emit(next)"],
  app: ["userSafetyCenterService", "userSafetySettings", "readReceiptsEnabled={userSafetySettings.enableReadReceipts}"],
  chatMain: ["readReceiptsEnabled", "readReceiptsEnabled={readReceiptsEnabled}"],
  messageList: ["readReceiptsEnabled", "readReceiptsEnabled={readReceiptsEnabled}"],
  messageItem: ["readReceiptsEnabled", "message-read-receipt-placeholder", "Reads on"],
  styles: ["message-read-receipt-placeholder"],
  docs: ["Read Receipts Placeholder", "Read receipts default off", "No per-message reader list"],
  packageJson: ["read-receipts:smoke"],
};

const missing = [];
for (const [key, phrases] of Object.entries(required)) {
  for (const phrase of phrases) {
    if (!text[key].includes(phrase)) {
      missing.push(`${files[key]} missing: ${phrase}`);
    }
  }
}

if (missing.length > 0) {
  console.error("Read receipts placeholder smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Read receipts placeholder smoke test passed.");

