import fs from 'node:fs';

const docPath = 'docs/community-discovery.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Community Discovery Production Plan',
  'Staging assumptions',
  'Beta assumptions',
  'Production assumptions',
  'Rollback plan',
  'Known risks',
  'MVP exclusions',
  'publicCommunityProfile'.replace('publicCommunityProfile', 'PublicCommunityProfileDTO'),
  'DiscoveryView',
  'mobile UI',
  'enableDiscovery'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Community discovery plan is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /service_role/i, /password\s*[:=]/i];
for (const pattern of forbidden) {
  if (pattern.test(text)) {
    console.error(`Community discovery plan contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Community discovery production plan smoke test passed.');
