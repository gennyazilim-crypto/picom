/**
 * Sets Supabase Auth mailer sender to Picom's production From address.
 *
 * Password-reset / verification From headers are owned by hosted Auth SMTP
 * (smtp_admin_email), not by the Picom renderer. This script patches only that
 * Auth config via the Management API.
 *
 * Required env:
 *   SUPABASE_ACCESS_TOKEN  - dashboard account token
 *   SUPABASE_PROJECT_REF   - project ref (e.g. ufmtvqtsklqsmqxefbbs)
 *
 * Optional env:
 *   AUTH_SMTP_ADMIN_EMAIL  - default info@picom.gg
 *   AUTH_SMTP_SENDER_NAME  - default Picom
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS - only when enabling custom SMTP
 *
 * Usage:
 *   node scripts/set-auth-smtp-sender.mjs
 *   node scripts/set-auth-smtp-sender.mjs --dry-run
 */
const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();
const accessToken = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const adminEmail = (process.env.AUTH_SMTP_ADMIN_EMAIL || "info@picom.gg").trim().toLowerCase();
const senderName = (process.env.AUTH_SMTP_SENDER_NAME || "Picom").trim();
const dryRun = process.argv.includes("--dry-run");

if (!/^[a-z0-9]{20}$/i.test(projectRef)) {
  console.error("Set SUPABASE_PROJECT_REF to the 20-character project ref.");
  process.exit(1);
}
if (!accessToken) {
  console.error("Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error("AUTH_SMTP_ADMIN_EMAIL must be a valid email address.");
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

async function getAuthConfig() {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GET auth config failed (${response.status}): ${body.slice(0, 240)}`);
  }
  return JSON.parse(body);
}

async function patchAuthConfig(payload) {
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`PATCH auth config failed (${response.status}): ${body.slice(0, 400)}`);
  }
  return body ? JSON.parse(body) : {};
}

const current = await getAuthConfig();
const currentFrom = String(current.smtp_admin_email || "").trim().toLowerCase();
const smtpConfigured = Boolean(current.smtp_host);

console.log(`Project: ${projectRef}`);
console.log(`Current Auth sender: ${currentFrom || "(default Supabase mailer)"}`);
console.log(`Target Auth sender: ${adminEmail} (${senderName})`);
console.log(`Custom SMTP host: ${smtpConfigured ? current.smtp_host : "not configured"}`);

const payload = {
  smtp_admin_email: adminEmail,
  smtp_sender_name: senderName,
};

const smtpHost = (process.env.SMTP_HOST || "").trim();
const smtpUser = (process.env.SMTP_USER || "").trim();
const smtpPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
const smtpPort = Number(process.env.SMTP_PORT || 465);

if (smtpHost) {
  if (!smtpUser || !smtpPass) {
    console.error("When SMTP_HOST is set, SMTP_USER and SMTP_PASS are required.");
    process.exit(1);
  }
  Object.assign(payload, {
    external_email_enabled: true,
    smtp_host: smtpHost,
    smtp_port: Number.isFinite(smtpPort) ? smtpPort : 587,
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
  });
} else if (!smtpConfigured) {
  console.error(`
Cannot switch Auth From to ${adminEmail} while the project still uses the default
Supabase mailer. Enable custom SMTP first (Resend, SendGrid, Amazon SES, etc.)
with a domain that is allowed to send as ${adminEmail}, then re-run:

  SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... node scripts/set-auth-smtp-sender.mjs

Or set Sender email to ${adminEmail} in:
  https://supabase.com/dashboard/project/${projectRef}/auth/smtp
`);
  process.exit(2);
}

if (currentFrom === adminEmail && !smtpHost) {
  console.log("Auth sender already matches. No change needed.");
  process.exit(0);
}

if (dryRun) {
  console.log("Dry run only. Would PATCH:", {
    ...payload,
    smtp_pass: payload.smtp_pass ? "[redacted]" : undefined,
  });
  process.exit(0);
}

const updated = await patchAuthConfig(payload);
const nextFrom = String(updated.smtp_admin_email || adminEmail).trim().toLowerCase();
console.log(`Updated Auth sender to ${nextFrom}.`);
console.log("Send a password-reset email from Settings > Account to verify the From header.");
