import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(
  resolve(root, "supabase/migrations/20260824120000_security_invoker_public_business_views.sql"),
  "utf8",
);
const platformServices = await readFile(
  resolve(root, "src/services/verificationBusiness/platformServices.ts"),
  "utf8",
);
const publicProfilePage = await readFile(
  resolve(root, "src/account/pages/BusinessPages.tsx"),
  "utf8",
);
const existingRls = await readFile(
  resolve(root, "supabase/tests/rls/verification_business_platform.sql"),
  "utf8",
);
const newRls = await readFile(
  resolve(root, "supabase/tests/rls/security_invoker_public_business_views.sql"),
  "utf8",
);

const requiredViews = [
  "public_profile_badges",
  "public_business_profiles",
  "public_brand_assets",
  "public_business_products",
  "public_business_posts",
  "business_application_owner_views",
];

if (!migration.includes("alter view public.%I set (security_invoker = true, security_barrier = true)")) {
  throw new Error("Migration must ALTER existing views to security_invoker without DROP/CREATE.");
}
for (const viewName of requiredViews) {
  if (!migration.includes(`'${viewName}'`) && !migration.includes(viewName)) {
    throw new Error(`Migration must name affected view ${viewName}.`);
  }
}

for (const forbidden of [
  "drop view public.public_profile_badges",
  "drop view public.public_business_profiles",
  "disable row level security",
  "using (true)",
  "grant all on public.public_profile_badges",
]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(`Migration contains forbidden pattern: ${forbidden}`);
  }
}

if (!platformServices.includes('.from("public_profile_badges")')) {
  throw new Error("badgeService must keep consuming public_profile_badges.");
}
if (!platformServices.includes('.from("public_business_profiles")')) {
  throw new Error("businessProfileService must keep consuming public_business_profiles.");
}
if (!platformServices.includes('.from("public_business_products")')) {
  throw new Error("businessProductService must keep consuming public_business_products.");
}
if (!publicProfilePage.includes("get_public_business_profile_bundle") && !publicProfilePage.includes("getPublicBundle")) {
  throw new Error("Business profile page must keep using the public profile bundle contract.");
}

for (const privateField of ["internal_review_notes", "registered_address", "granted_by", "uploaded_by"]) {
  if (platformServices.includes(privateField)) {
    throw new Error(`platformServices must not request private field ${privateField}.`);
  }
}

if (!newRls.includes("security_invoker=true") || !newRls.includes("anon cannot read an unpublished business profile")) {
  throw new Error("New RLS matrix must cover invoker views and unpublished isolation.");
}
if (!existingRls.includes("cannot read private legal_name of a published profile")) {
  throw new Error("Existing business platform RLS test must cover private legal_name isolation.");
}

console.log("Security-invoker public view contract regression passed.");
