export const EMAIL_IDENTITY = Object.freeze({
  fromAddress: "info@picom.gg",
  fromName: "Picom",
  replyTo: "info@picom.gg",
  visibleFrom: "Picom <info@picom.gg>",
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedHosts = new Set(["picom.gg", "www.picom.gg", "api.picom.gg"]);

export function normalizeRecipient(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!emailPattern.test(email) || email.length > 320 || /[\r\n]/.test(email)) throw new Error("EMAIL_RECIPIENT_INVALID");
  return email;
}

export function assertSenderPolicy(input = {}) {
  const from = String(input.fromAddress ?? EMAIL_IDENTITY.fromAddress).trim().toLowerCase();
  const replyTo = String(input.replyTo ?? EMAIL_IDENTITY.replyTo).trim().toLowerCase();
  const fromName = String(input.fromName ?? EMAIL_IDENTITY.fromName).trim();
  if (from !== EMAIL_IDENTITY.fromAddress || replyTo !== EMAIL_IDENTITY.replyTo || fromName !== EMAIL_IDENTITY.fromName) {
    throw new Error("EMAIL_SENDER_POLICY_VIOLATION");
  }
  return EMAIL_IDENTITY;
}

export function assertSafeActionUrl(value) {
  if (!value) return null;
  const url = new URL(String(value));
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new Error("EMAIL_ACTION_URL_INVALID");
  }
  return url.toString();
}

export function sanitizeTemplateText(value, maxLength = 1000) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text.slice(0, maxLength);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

