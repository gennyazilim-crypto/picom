import fs from 'node:fs';

const files = {
  service: 'src/services/notificationService.ts',
  main: 'electron/main.cts',
  preload: 'electron/preload.cts',
  types: 'src/types/picomDesktop.d.ts',
  rendererSmoke: 'scripts/renderer-native-api-smoke-test.mjs',
  doc: 'docs/native-notifications.md'
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));

const required = [
  [text.service, 'getNativeNotificationBridge'],
  [text.service, 'decideNotificationRoute'],
  [text.service, 'routing?: Omit<NotificationRouteContext, "category">'],
  [text.service, 'return { ok: true, permission: "granted" }'],
  [text.main, 'parseNotificationPayload'],
  [text.main, 'Notification.isSupported()'],
  [text.main, 'new Notification'],
  [text.preload, 'showNotification'],
  [text.preload, 'IPC_CHANNELS.notificationShow'],
  [text.types, 'showNotification?:'],
  [text.doc, 'Native Desktop Notifications'],
  [text.doc, 'React components must not call Electron'],
  [text.doc, 'do-not-disturb hint'],
  [text.rendererSmoke, 'forbiddenPatterns']
];

const missing = required.filter(([haystack, needle]) => !haystack.includes(needle)).map(([, needle]) => needle);
if (missing.length > 0) {
  console.error(`Native notifications integration is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(Object.values(text).join('\n'))) {
    console.error(`Native notifications integration contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Native desktop notifications integration smoke test passed.');
