import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serviceText = readFileSync("supabase/functions/_shared/email-service.ts", "utf8");
const envText = readFileSync("supabase/functions/.env.example", "utf8");

assert.match(serviceText, /createEmailService/);
assert.match(serviceText, /sendEmail/);
assert.match(serviceText, /sendPasswordResetEmailPlaceholder/);
assert.match(serviceText, /sendVerificationEmailPlaceholder/);
assert.match(serviceText, /sendInviteEmailPlaceholder/);
assert.match(serviceText, /redactTokenPreview/);

assert.doesNotMatch(serviceText, /console\.info\(message/);
assert.doesNotMatch(serviceText, /resetToken,\s*$/m);
assert.doesNotMatch(serviceText, /verificationToken,\s*$/m);

assert.match(envText, /EMAIL_PROVIDER=log/);
assert.match(envText, /SMTP_HOST_PLACEHOLDER=/);
assert.match(envText, /SMTP_PASS_PLACEHOLDER=/);

console.log("OK email service placeholder smoke test completed");
