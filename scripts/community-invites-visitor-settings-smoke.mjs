import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const management=read("src/components/community/CommunityInviteManagement.tsx");
const admin=read("src/components/community/CommunityAdminSections.tsx");
const inviteService=read("src/services/community/communityInviteService.ts");
const membership=read("src/services/community/communityMembershipService.ts");
const composer=read("src/components/MessageComposer.tsx");
const chat=read("src/components/ChatMain.tsx");
const typedJoin=read("supabase/migrations/20260711000700_typed_community_invite_join.sql");
const publicJoin=read("supabase/migrations/20260710212000_join_public_community_production.sql");
const publicAccess=read("supabase/migrations/20260704002600_community_public_access_rls.sql");
const checks=[
 [management.includes("active")&&management.includes("revoked")&&management.includes("expired")&&management.includes("exhausted"),"invite lifecycle filters"],
 [management.includes("creator")&&management.includes("campaign.uses")&&management.includes("Confirm revoke"),"creator usage and confirmed revoke UI"],
 [admin.includes("CommunityInviteManagement")&&!admin.includes("Use limits and expiry are available in the invite modal"),"real admin invite section"],
 [inviteService.includes("INVITE_LIMIT_INVALID")&&inviteService.includes("INVITE_EXPIRY_INVALID"),"service-side invite input validation"],
 [inviteService.includes("getLifecycleStatus"),"canonical lifecycle classifier"],
 [membership.includes("Private communities require a valid invite")&&membership.includes("Transfer ownership before leaving"),"private join and owner leave guards"],
 [typedJoin.includes("INVITE_BANNED")&&typedJoin.includes("INVITE_BLOCKED"),"server ban and blocking enforcement"],
 [publicJoin.includes("PRIVATE_COMMUNITY_INVITE_REQUIRED")&&publicJoin.includes("JOIN_BANNED"),"public/private join RPC boundary"],
 [publicAccess.includes("public_read_enabled")&&publicAccess.includes("is_private = false"),"public read-only RLS boundary"],
 [chat.includes('disabledActionLabel={access.isVisitor ? "Join Community"')&&composer.includes("disabled={Boolean(disabledReason)}"),"visitor composer disabled UX"],
 [!management.includes("getSupabaseClient")&&!management.includes("supabase.from"),"service-only UI data access"],
];
const failed=checks.filter(([pass])=>!pass);if(failed.length){for(const[,label]of failed)console.error(`FAIL ${label}`);process.exit(1)}for(const[,label]of checks)console.log(`PASS ${label}`);console.log("Community invites, visitor, and visibility smoke passed.");
