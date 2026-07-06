import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  service: "src/services/notificationPermissionOnboardingService.ts",
  component: "src/components/NotificationPermissionPrompt.tsx",
  app: "src/App.tsx",
  styles: "src/styles.css",
  docs: "docs/notification-permission-onboarding.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  service: [
    "notificationPermissionOnboardingService",
    "community_created",
    "first_message_sent",
    "notification_settings_opened",
    "notificationService.getStatus",
    "dismissed",
    "prompted",
  ],
  component: ["NotificationPermissionPrompt", "Allow notifications", "Not now", "notification-permission-prompt"],
  app: [
    "NotificationPermissionPrompt",
    "notificationPermissionOnboardingService.getPrompt",
    "notificationPermissionOnboardingService.markPrompted",
    "notificationService.requestPermission",
  ],
  styles: ["notification-permission-prompt", "notification-permission-actions"],
  docs: ["does not appear on app startup", "Dismissal persists locally", "notificationService.requestPermission"],
  packageJson: ["notifications:permission-onboarding:smoke"],
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
  console.error("Notification permission onboarding smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Notification permission onboarding smoke test passed.");

