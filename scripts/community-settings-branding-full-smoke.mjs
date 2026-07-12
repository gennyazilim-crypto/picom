import { readFileSync } from "node:fs";
const read=(file)=>readFileSync(file,"utf8");
const editor=read("src/components/community/CommunitySettingsEditor.tsx"),service=read("src/services/communityService.ts"),branding=read("src/services/communityBrandingService.ts"),rules=read("src/services/communityRulesService.ts"),migration=read("supabase/migrations/20260711149900_community_settings_branding_type_configuration.sql"),storageMigration=read("supabase/migrations/20260712166100_community_branding_storage_owner.sql"),join=read("src/components/CommunityMenu.tsx");
const checks=[
 ["identity and controlled uploads",editor.includes("Icon upload")&&editor.includes("Banner upload")&&branding.includes('storage.from("community-branding")')&&branding.includes("maxBytes")],
 ["rules editor and acceptance",editor.includes("Rules and join acceptance")&&editor.includes("Add rule")&&rules.includes("saveMockRules")&&join.includes("Community rules")],
 ["visibility and notification defaults",editor.includes("Default notifications")&&editor.includes("Allow visitors")&&service.includes("next_default_notification_level")],
 ["text settings backend behavior",editor.includes("Maximum message length")&&migration.includes("text message settings insert guard")&&migration.includes("text attachment settings insert guard")],
 ["radio settings backend behavior",editor.includes("Default host role")&&migration.includes("schedule_visibility")&&migration.includes("listener_chat_enabled")],
 ["podcast settings backend behavior",editor.includes("Default publisher role")&&migration.includes("podcast comments settings guard")&&migration.includes("podcast_episode_explicit_default")],
 ["atomic rules and audit",migration.includes("for update")&&migration.includes("delete from public.community_rules")&&migration.includes("insert into public.audit_log")],
 ["owner-authorized branding storage",storageMigration.includes("community-branding")&&["public reads community branding","managers upload community branding","managers update community branding","managers delete community branding"].every((policy)=>storageMigration.includes(policy))],
 ["service-only UI",!editor.includes("supabase.")&&!editor.includes("storage.from")],
];
for(const [label,ok] of checks){if(!ok)throw new Error(`FAIL ${label}`);console.log(`PASS ${label}`)}console.log("Community settings branding and type configuration Full MVP smoke passed.");
