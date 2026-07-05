import fs from 'node:fs';

const docPath = 'docs/analytics.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Privacy-Friendly Analytics Placeholder',
  'message_sent_count_only',
  'Prohibited data',
  'message content',
  'auth tokens',
  'enableAnalyticsPlaceholder',
  'Staging assumptions',
  'Beta assumptions',
  'Production assumptions',
  'Rollback plan',
  'No analytics provider secret is bundled into the renderer'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Analytics placeholder doc is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbiddenSecretPatterns = [
  /sk-[a-zA-Z0-9]/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^<\s]/,
  /LIVEKIT_API_SECRET\s*=\s*[^<\s]/,
  /password\s*[:=]\s*['\"][^'\"]+['\"]/i
];

for (const pattern of forbiddenSecretPatterns) {
  if (pattern.test(text)) {
    console.error(`Analytics placeholder doc appears to contain a secret-like value: ${pattern}`);
    process.exit(1);
  }
}

console.log('Privacy-friendly analytics placeholder smoke test passed.');
