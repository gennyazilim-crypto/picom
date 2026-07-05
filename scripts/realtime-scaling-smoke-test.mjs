import fs from 'node:fs';

const servicePath = 'src/services/supabase/realtimeScalingService.ts';
const docPath = 'docs/realtime-scaling.md';
const envPath = '.env.example';
const appConfigPath = 'src/config/appConfig.ts';

const service = fs.readFileSync(servicePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');
const env = fs.readFileSync(envPath, 'utf8');
const appConfig = fs.readFileSync(appConfigPath, 'utf8');

const required = [
  [service, 'RealtimeScalingMode'],
  [service, 'supabase_managed'],
  [service, 'external_pubsub_placeholder'],
  [service, 'realtimeScalingService'],
  [service, 'getRoomMetadata'],
  [service, 'featureFlagService.isEnabled("enableRealtime")'],
  [doc, 'Realtime Horizontal Scaling Preparation'],
  [doc, 'VITE_REALTIME_SCALING_MODE'],
  [doc, 'Supabase Realtime remains the default MVP mode'],
  [doc, 'Feature flags are not treated as security enforcement'],
  [env, 'VITE_REALTIME_SCALING_MODE='],
  [appConfig, 'realtimeScalingMode:']
];

const missing = required.filter(([text, needle]) => !text.includes(needle)).map(([, needle]) => needle);
if (missing.length > 0) {
  console.error(`Realtime scaling foundation is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /REDIS_URL\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(`${service}\n${doc}\n${env}\n${appConfig}`)) {
    console.error(`Realtime scaling foundation contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Realtime horizontal scaling preparation smoke test passed.');
