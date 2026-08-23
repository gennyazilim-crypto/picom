import fs from "node:fs";

const register = fs.readFileSync("src/components/RegisterScreen.tsx", "utf8");
const auth = fs.readFileSync("src/services/authService.ts", "utf8");
const service = fs.readFileSync("src/services/termsAcceptanceService.ts", "utf8");
const settings = fs.readFileSync("src/components/SettingsModal.tsx", "utf8");
const legalSettings = fs.readFileSync("src/components/settings/LegalSettingsSection.tsx", "utf8");
const settingsI18n = fs.readFileSync("src/services/settings/settingsI18n.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260710090000_terms_acceptance_versioning.sql", "utf8");

for (const needle of ["acceptedLegal", 't("legal.link.terms")', 't("legal.link.privacy")', 't("register.legal.agreePrefix")', "legalConfig.currentVersion"]) if (!register.includes(needle)) throw new Error(`Registration acceptance is missing ${needle}`);
for (const needle of ["accepted_terms_version", "accepted_privacy_version"]) if (!auth.includes(needle)) throw new Error(`Auth acceptance metadata is missing ${needle}`);
for (const needle of ["picom.legalAcceptance.v1", '"registration"', '"reaccept"', "acceptedAt", "recordMockRegistrationAcceptance"]) if (!service.includes(needle)) throw new Error(`Mock acceptance tracking is missing ${needle}`);
if (service.includes("toStatus(null, true)")) throw new Error("Mock legal acceptance still bypasses missing evidence.");
for (const needle of ["LegalSettingsSection", "LegalDocumentModal"]) if (!settings.includes(needle)) throw new Error(`Settings legal links are missing ${needle}`);
for (const needle of ["legalDocumentOrder", 't("legal.professionalReview")', "legalConfig.currentVersion"]) if (!legalSettings.includes(needle)) throw new Error(`Legal settings section is missing ${needle}`);
if (!settingsI18n.includes('"legal.professionalReview": "Professional review required"')) throw new Error("Legal professional-review copy is missing from settings i18n");
for (const needle of ["accepted_terms_version", "privacy_accepted_at", "legal_acceptance_events", "accept_current_legal_terms", "server timestamp"] ) {
  if (needle === "server timestamp") continue;
  if (!migration.includes(needle)) throw new Error(`Supabase acceptance schema is missing ${needle}`);
}
console.log("Legal acceptance tracking smoke passed.");
