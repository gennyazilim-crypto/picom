import fs from 'node:fs';

const docPath = 'docs/developer-portal-placeholder.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Developer Portal Placeholder',
  'My Bots',
  'Webhooks',
  'Applications',
  'API Keys placeholder',
  'GET /developer/apps',
  'POST /developer/apps',
  'PATCH /developer/apps/:appId',
  'DELETE /developer/apps/:appId',
  'Do not include raw API keys',
  'No mobile UI',
  'post-MVP'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Developer Portal placeholder doc is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [
  /sk-[a-zA-Z0-9]/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^<\s]/,
  /password\s*[:=]\s*['\"][^'\"]+['\"]/i
];

for (const pattern of forbidden) {
  if (pattern.test(text)) {
    console.error(`Developer Portal placeholder doc appears to contain a secret-like value: ${pattern}`);
    process.exit(1);
  }
}

console.log('Developer Portal placeholder smoke test passed.');
