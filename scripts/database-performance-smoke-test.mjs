import fs from 'node:fs';

const docPath = 'docs/database-performance.md';
const indexPath = 'supabase/migrations/20260704001200_chat_query_indexes.sql';
const doc = fs.readFileSync(docPath, 'utf8');
const indexes = fs.readFileSync(indexPath, 'utf8');

const requiredDoc = [
  'Database Performance Audit',
  'Message queries by channel and createdAt',
  'Message pagination',
  'Optimistic duplicate prevention',
  'Community/channel list lookup',
  'Community member lookup',
  'Attachment lookup by message',
  'Search queries',
  'Notification inbox queries',
  'Audit log queries',
  'Over-indexing guidance'
];

const requiredIndexes = [
  'idx_messages_channel_created_id_desc',
  'idx_messages_community_created_at',
  'idx_messages_channel_author_created_at',
  'idx_channels_community_category_position',
  'idx_community_members_community_role_joined',
  'idx_read_states_user_updated_at',
  'idx_attachments_message_created_at'
];

const missing = [
  ...requiredDoc.filter((item) => !doc.includes(item)).map((item) => `doc:${item}`),
  ...requiredIndexes.filter((item) => !indexes.includes(item)).map((item) => `index:${item}`)
];

if (missing.length > 0) {
  console.error(`Database performance audit is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [/sk-[a-zA-Z0-9]/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for (const pattern of forbidden) {
  if (pattern.test(`${doc}\n${indexes}`)) {
    console.error(`Database performance audit contains forbidden secret-like text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Database performance audit smoke test passed.');
