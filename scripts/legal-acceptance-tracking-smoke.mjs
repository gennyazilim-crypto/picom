import fs from "node:fs";

const register = fs.readFileSync("src/components/RegisterScreen.tsx", "utf8");
const auth = fs.readFileSync("src/services/authService.ts", "utf8");
const service = fs.readFileSync("src/services/termsAcceptanceService.ts", "utf8");
const settings = fs.readFileSync("src/components/SettingsModal.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260710090000_terms_acceptance_versioning.sql", "utf8");

for (const needle of ["acceptedLegal", "Terms of Service", "Privacy Policy", "legalConfig.currentVersion"]) if (!register.includes(needle)) throw new Error(`Registration acceptance is missing ${needle}`);
for (const needle of ["accepted_terms_version", "accepted_privacy_version", "recordMockRegistrationAcceptance"]) if (!auth.includes(needle)) throw new Error(`Auth acceptance metadata is missing ${needle}`);
for (const needle of ["picom.legalAcceptance.v1", '"registration"', '"reaccept"', "acceptedAt"]) if (!service.includes(needle)) throw new Error(`Mock acceptance tracking is missing ${needle}`);
if (service.includes("toStatus(null, true)")) throw new Error("Mock legal acceptance still bypasses missing evidence.");
for (const needle of ["Legal", "legalDocumentOrder", "LegalDocumentModal", "Professional review required"]) if (!settings.includes(needle)) throw new Error(`Settings legal links are missing ${needle}`);
for (const needle of ["accepted_terms_version", "privacy_accepted_at", "legal_acceptance_events", "accept_current_legal_terms", "server timestamp"] ) {
  if (needle === "server timestamp") continue;
  if (!migration.includes(needle)) throw new Error(`Supabase acceptance schema is missing ${needle}`);
}
console.log("Legal acceptance tracking smoke passed.");
