import fs from 'node:fs';

const servicePath = 'src/services/featureFlagService.ts';
const docPath = 'docs/feature-flags.md';
const envPath = '.env.example';

const service = fs.readFileSync(servicePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');
const env = fs.readFileSync(envPath, 'utf8');

const requiredService = [
  'FEATURE_FLAG_KEYS',
  'FeatureFlagKey',
  'enableRealtime',
  'enableVoiceRooms',
  'enableDiscovery',
  'enableBots',
  'enableWebhooks',
  'enableThreads',
  'enablePolls',
  'enableDiagnostics',
  'enableAnalyticsPlaceholder',
  'applyRemoteConfig',
  'shouldShowEntryPoint',
  'getAvailability',
  'sanitizeOverrides'
];

const requiredDoc = [
  'Feature Flags Foundation',
  'Feature flags are an availability and rollout tool, not a security boundary',
  'VITE_FEATURE_FLAGS',
  'Remote config must never include',
  'Supabase service role keys',
  'LiveKit secrets',
  'Backend/Supabase must still enforce'
];

const missingService = requiredService.filter((item) => !service.includes(item));
const missingDoc = requiredDoc.filter((item) => !doc.includes(item));
const missingEnv = env.includes('VITE_FEATURE_FLAGS=') ? [] : ['VITE_FEATURE_FLAGS'];
const missing = [...missingService.map((item) => `service:${item}`), ...missingDoc.map((item) => `doc:${item}`), ...missingEnv.map((item) => `env:${item}`)];

if (missing.length > 0) {
  console.error(`Feature flags foundation is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /service_role\s*=/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(`${service}\n${doc}\n${env}`)) {
    console.error(`Feature flags foundation contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Feature flags foundation smoke test passed.');
