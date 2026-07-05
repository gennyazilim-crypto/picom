import fs from 'node:fs';

const docPath = 'docs/message-retention.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Message Retention and Archiving',
  'Runtime deletion job: not enabled',
  'globalRetentionDays',
  'communityRetentionDays',
  'deletedMessageRetentionDays',
  'attachmentRetentionDays',
  'archiveOldMessages',
  'purgeExpiredDeletedMessages',
  'Dry-run first policy',
  'Supabase/RLS considerations',
  'Production retention must require',
  'Rollback limitations',
  'Audit logs must be retained separately'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Message retention document is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [
  /sk-[a-zA-Z0-9]/,
  /SERVICE_ROLE\s*=\s*[^<\s]/i,
  /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i,
  /password\s*[:=]\s*['\"][^'\"]+['\"]/i
];

for (const pattern of forbidden) {
  if (pattern.test(text)) {
    console.error(`Message retention document contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Message retention and archiving smoke test passed.');
