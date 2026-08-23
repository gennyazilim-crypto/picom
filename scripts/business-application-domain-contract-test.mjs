import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803220000_business_application_verification_and_team_management.sql"), "utf8");
const service = await readFile(resolve(root, "src/services/verificationBusiness/businessApplicationService.ts"), "utf8");
const organization = await readFile(resolve(root, "src/services/verificationBusiness/businessOrganizationService.ts"), "utf8");
const required = ["upsert_business_application_draft", "submit_business_application_snapshot", "approve_business_application", "transition_business_application", "create_organization_invitation", "get_business_application_applicant_dto", "get_public_business_profile_bundle"];
for (const name of required) if (!migration.includes(name)) throw new Error(`Missing business RPC: ${name}`);
for (const transition of ["('draft','submitted')", "('submitted','approved')", "('under_review','approved')", "('approved','suspended')", "('suspended','revoked')"]) if (!migration.includes(transition)) throw new Error(`Missing transition: ${transition}`);
if (!migration.includes("LEGAL_COPY_REQUIRED")) throw new Error("Submit must fail closed without active legal copy.");
if (!migration.includes("BUSINESS_DOCUMENT_MALWARE_REVIEW_REQUIRED")) throw new Error("Approve must fail closed on pending malware.");
if (migration.includes("DROP TABLE")) throw new Error("Additive migration must not DROP TABLE.");
if (!migration.includes("get_public_business_profile_bundle") || !migration.includes("'verifiedBusiness'")) throw new Error("Public profile DTO must be allowlisted.");
if (service.includes("internal_review_notes")) throw new Error("Applicant DTO service must not map internal review notes.");
if (!organization.includes('crypto.subtle.digest("SHA-256"') || !organization.includes("target_token_hash")) throw new Error("Invitation tokens must be SHA-256 hashed before RPC use.");
console.log("Business application domain contract passed.");
