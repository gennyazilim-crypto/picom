import fs from 'node:fs';

const docPath = 'docs/attachment-delivery.md';
const text = fs.readFileSync(docPath, 'utf8');

const required = [
  'Attachment CDN and Signed URL Plan',
  'Public vs private attachments',
  'Signed URL placeholder contract',
  'CDN cache behavior placeholder',
  'Thumbnail strategy',
  'Validation and scanning',
  'Private channel access rules',
  'getSignedUrlPlaceholder',
  'generateThumbnailPlaceholder',
  'Rollback plan',
  'Logs and diagnostics redact signed query strings'
];

const missing = required.filter((item) => !text.includes(item));
if (missing.length > 0) {
  console.error(`Attachment delivery plan is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = [
  /sk-[a-zA-Z0-9]/,
  /SERVICE_ROLE\s*=\s*[^<\s]/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^<\s]/i,
  /password\s*[:=]\s*['\"][^'\"]+['\"]/i,
  /signedUrl\s*[:=]\s*['\"]https?:\/\//i
];

for (const pattern of forbidden) {
  if (pattern.test(text)) {
    console.error(`Attachment delivery plan contains forbidden secret-like or concrete signed URL text: ${pattern}`);
    process.exit(1);
  }
}

console.log('Attachment CDN and signed URL plan smoke test passed.');
