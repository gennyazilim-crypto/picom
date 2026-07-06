import fs from "node:fs";

const docPath = "docs/enterprise-sso-saml.md";
const doc = fs.readFileSync(docPath, "utf8");
const required = [
  "Placeholder only",
  "No IdP metadata, private keys, certificates, or signing secrets are committed",
  "Supabase Postgres RLS",
  "Desktop flow considerations",
  "Security requirements before implementation",
  "Audit logging",
  "Risks and open questions",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`SSO/SAML placeholder missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("SSO/SAML enterprise placeholder smoke test passed.");
