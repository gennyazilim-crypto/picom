import fs from "node:fs";
const checks = [
  ["src/services/permissions/communityPermissions.ts", ["canModerateCommunityMember", "targetRole.level >= 100", "actorLevel > targetRole.level"]],
  ["src/services/memberManagementService.ts", ["moderate_community_member", "auditLogService.append", "moderation_action"]],
  ["src/components/MemberModerationModal.tsx", ["Reason", "Timeout duration", "role=\"alertdialog\""]],
  ["supabase/migrations/20260710220000_member_management_mvp_polish.sql", ["OWNER_PROTECTED", "ROLE_HIERARCHY_DENIED", "moderation_action_records"]],
];
for (const [file, needles] of checks) { const source = fs.readFileSync(file, "utf8"); for (const needle of needles) if (!source.includes(needle)) throw new Error(`${file} is missing ${needle}`); }
console.log("Member management MVP polish smoke passed.");
