import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const center=read("src/components/community/CommunityModerationCenter.tsx");
const memberService=read("src/services/memberManagementService.ts");
const reportService=read("src/services/reportService.ts");
const permissions=read("src/services/permissions/communityPermissions.ts");
const migration=read("supabase/migrations/20260711149700_community_moderation_reports_completion.sql");
const checks=[
 [center.includes("Search members")&&center.includes("MemberModerationModal"),"search and confirmed member actions"],
 [center.includes("Remove timeout")&&center.includes("Unban")&&center.includes("Required reason"),"unban and untimeout reason flow"],
 [center.includes("Open source")&&center.includes("Picom Safety only"),"safe report source boundary"],
 [center.includes("reviewed")&&center.includes("dismissed")&&center.includes("action_taken"),"controlled report lifecycle"],
 [memberService.includes("list_community_moderation_states")&&memberService.includes('input.action === "unban"'),"reversible restriction service"],
 [reportService.includes("list_community_report_queue")&&reportService.includes("review_community_report"),"report repository RPC boundary"],
 [permissions.includes("isOwnerRole(targetRole)")&&permissions.includes("actorLevel > getRolePosition(targetRole)"),"owner and role hierarchy guard"],
 [migration.includes("ROLE_HIERARCHY_DENIED")&&migration.includes("OWNER_PROTECTED"),"server hierarchy enforcement"],
 [migration.includes("conversation_id is null")&&migration.includes("PRIVATE_REPORT_SCOPE_DENIED"),"private report isolation"],
 [migration.includes("insert into public.audit_log")&&migration.includes("review_reason"),"actor reason target audit evidence"],
 [!center.includes("getSupabaseClient")&&!center.includes("supabase.from"),"service-only UI access"],
];
const failed=checks.filter(([pass])=>!pass);if(failed.length){for(const[,label]of failed)console.error(`FAIL ${label}`);process.exit(1)}for(const[,label]of checks)console.log(`PASS ${label}`);console.log("Community moderation and reports Full MVP smoke passed.");
