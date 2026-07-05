import fs from 'node:fs';

const files = {
  main: 'electron/main.cts',
  preload: 'electron/preload.cts',
  builder: 'electron-builder.yml',
  renderer: 'src/services/deepLinkService.ts',
  doc: 'docs/deep-links.md',
  types: 'src/types/picomDesktop.d.ts'
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));

const required = [
  [text.main, 'app.setAsDefaultProtocolClient("picom"'],
  [text.main, 'app.on("open-url"'],
  [text.main, 'app.on("second-instance"'],
  [text.main, 'isSupportedPicomDeepLink'],
  [text.main, 'safeDeepLinkSegmentPattern'],
  [text.preload, 'deepLinks'],
  [text.preload, 'isSupportedPicomDeepLink'],
  [text.preload, 'safeDeepLinkSegmentPattern'],
  [text.builder, 'protocols:'],
  [text.builder, 'name: Picom Protocol'],
  [text.builder, '- picom'],
  [text.renderer, 'parseDeepLink'],
  [text.renderer, 'simulateDeepLink'],
  [text.types, 'deepLinks?:'],
  [text.doc, 'picom://invite/{code}'],
  [text.doc, 'picom://community/{communityId}/channel/{channelId}/message/{messageId}'],
  [text.doc, 'Deep links never execute shell commands'],
  [text.doc, 'Unknown routes fail closed']
];

const missing = required.filter(([haystack, needle]) => !haystack.includes(needle)).map(([, needle]) => needle);
if (missing.length > 0) {
  console.error(`Protocol handler wiring is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/shell\.openPath\(/, /child_process/, /execFile/, /javascript:/i.test(text.main) ? /javascript:/i : /a^/];
for (const pattern of forbidden) {
  if (pattern.test(`${text.main}\n${text.preload}`)) {
    console.error(`Protocol handler wiring contains forbidden native execution pattern: ${pattern}`);
    process.exit(1);
  }
}

console.log('Desktop protocol handler wiring smoke test passed.');
