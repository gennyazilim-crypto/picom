import fs from 'node:fs';

const servicePath = 'src/services/versionCompatibilityService.ts';
const docPath = 'docs/client-server-version-compatibility.md';
const remoteDocPath = 'docs/remote-config.md';

const service = fs.readFileSync(servicePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');
const remoteDoc = fs.readFileSync(remoteDocPath, 'utf8');

const requiredService = [
  'VersionCompatibilityStatus',
  'parseSemver',
  'compareSemver',
  'evaluateVersionCompatibility',
  'update_required',
  'update_recommended',
  'unknown',
  'refreshRemoteConfig'
];

const requiredDoc = [
  'Client/Server Version Compatibility',
  'minimumSupportedVersion',
  'recommendedClientVersion',
  'latestVersion',
  'update_required',
  'Safe fallback behavior',
  'Backend/Supabase enforcement',
  'Windows, Linux, and macOS'
];

const missing = [
  ...requiredService.filter((item) => !service.includes(item)).map((item) => `service:${item}`),
  ...requiredDoc.filter((item) => !doc.includes(item)).map((item) => `doc:${item}`),
  ...['minimumSupportedVersion', 'recommendedClientVersion', 'latestVersion'].filter((item) => !remoteDoc.includes(item)).map((item) => `remote-doc:${item}`)
];

if (missing.length > 0) {
  console.error(`Version compatibility foundation is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(`${service}\n${doc}\n${remoteDoc}`)) {
    console.error(`Version compatibility foundation contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Client/server version compatibility smoke test passed.');
