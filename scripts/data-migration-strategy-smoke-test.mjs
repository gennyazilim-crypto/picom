import fs from 'node:fs';

const docPath = 'docs/data-migration-strategy.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Data Migration Strategy',
  'Local migration workflow',
  'Staging migration workflow',
  'Production migration workflow',
  'Backup before migration',
  'Rollback limitations',
  'Zero-downtime placeholder',
  'Breaking schema change process',
  'Seed data policy',
  'Migration testing checklist',
  'Handling failed migrations',
  'Desktop client compatibility'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Data migration strategy doc is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /service_role\s*=/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(text)) {
    console.error(`Data migration strategy doc contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Data migration strategy smoke test passed.');
