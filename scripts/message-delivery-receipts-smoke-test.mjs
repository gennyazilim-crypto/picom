import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  types: "src/types/community.ts",
  service: "src/services/messageDeliveryReceiptService.ts",
  item: "src/components/MessageItem.tsx",
  styles: "src/styles.css",
  docs: "docs/message-delivery-receipts.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  types: ["MessageDeliveryStatus", "queued_offline", "localStatus?: MessageDeliveryStatus"],
  service: ["messageDeliveryReceiptService", "getLabel", "getDescription", "isRecoverable"],
  item: [
    "messageDeliveryReceiptService",
    "message-delivery-status",
    "message-delivery-actions",
    "Retry placeholder",
    "Copy text",
    "Remove placeholder",
    "clipboardService.copyText",
  ],
  styles: ["message-delivery-status", "status-queued_offline", "message-delivery-actions"],
  docs: ["Message Delivery Receipts Placeholder", "queued_offline", "Recoverable failure placeholder"],
  packageJson: ["message:delivery-receipts:smoke"],
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
  console.error("Message delivery receipts smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Message delivery receipts smoke test passed.");

