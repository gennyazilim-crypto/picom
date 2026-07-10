import fs from 'node:fs';

const files = {
  service: 'src/services/remoteConfigService.ts',
  edge: 'supabase/functions/client-config/index.ts',
  doc: 'docs/remote-config.md',
  env: '.env.example',
  appConfig: 'src/config/appConfig.ts'
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));

const required = {
  service: [
    'ClientRemoteConfig',
    'remoteConfigService',
    'getRemoteConfigUrl',
    'featureFlagService.applyRemoteConfig',
    'sanitizeRemoteConfig',
    'loadCachedConfig',
    'DEFAULT_MAX_UPLOAD_BYTES',
    'CACHE_MAX_AGE_MS',
    'MAX_RESPONSE_BYTES',
    'toPublicUrl',
    'readRemoteConfigResponse'
  ],
  edge: [
    'Deno.serve',
    'minimumSupportedVersion',
    'featureFlags',
    'uploadLimits',
    'enableScreenShare',
    'enableAdminOperations',
    'PICOM_MINIMUM_SUPPORTED_VERSION'
  ],
  doc: [
    'Remote Config Foundation',
    'VITE_REMOTE_CONFIG_URL',
    'Edge Function public env placeholders',
    'Do not put Supabase service role keys',
    'Fail-safe behavior',
    'Backend/Supabase RLS'
  ],
  env: ['VITE_APP_VERSION=', 'VITE_REMOTE_CONFIG_URL='],
  appConfig: ['version:', 'remoteConfigUrl:']
};

const missing = [];
for (const [key, values] of Object.entries(required)) {
  for (const value of values) {
    if (!text[key].includes(value)) missing.push(`${key}:${value}`);
  }
}

if (missing.length > 0) {
  console.error(`Remote config foundation is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(Object.values(text).join('\n'))) {
    console.error(`Remote config foundation contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Remote config foundation smoke test passed.');
