import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711149500_type_aware_community_structure_management.sql");
const component = read("src/components/CommunityStructureManagementPanel.tsx");
const service = read("src/services/community/communityStructureService.ts");
const menu = read("src/components/CommunityMenu.tsx");

const checks = [
  [migration.includes("community_structure_sections"), "type-aware structure table"],
  [migration.includes("REQUIRED_SECTION_RECOVERY_REQUIRED"), "required section deletion guard"],
  [migration.includes("create policy community_structure_sections_visible"), "RLS visibility policy"],
  [migration.includes("move_managed_channel") && migration.includes("move_managed_category"), "persistent accessible ordering RPCs"],
  [migration.includes("list_community_permission_overrides_for_scope"), "scoped override read contract"],
  [component.includes('community.kind === "text"') && component.includes('community.kind === "radio"'), "community-kind UI branching"],
  [component.includes("Restore missing defaults") && component.includes("aria-label={`Move"), "recovery and accessible controls"],
  [!component.includes("supabase.from") && !component.includes("getSupabaseClient"), "service-only component data access"],
  [service.includes("set_community_permission_override") && service.includes("localStorage"), "Supabase and persistent mock service paths"],
  [menu.includes("sectionTools?.channels ??"), "single management-center channel surface"],
];

const failed = checks.filter(([pass]) => !pass);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS ${label}`);
console.log("Community structure management smoke passed.");
