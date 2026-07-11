import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const types = await read("src/types/communityAccess.ts");
const source = await read("src/services/permissions/communityPermissions.ts");
const migration = await read("supabase/migrations/20260711149200_community_role_permission_schema_completion.sql");
const rls = await read("supabase/tests/rls/community_role_permission_schema.sql");
const databaseTypes = await read("src/services/supabase/database.types.ts");

const keys = ["manageCommunity","manageChannels","manageCategories","managePermissionOverrides","manageRoles","manageMembers","moderateMembers","moderateMessages","deleteAnyMessage","createInvites","viewInsights","viewAuditLog","manageTextCommunity","viewChannel","sendMessages","sendAnnouncements","uploadAttachments","addReactions","viewPrivateChannels","joinVoice","speakInVoice","shareScreen","viewRadioContent","listenRadio","hostRadio","manageRadioCommunity","manageRadioSchedule","manageRadioPrograms","manageRadioHosts","publishRadioAnnouncements","moderateRadioComments","viewPodcastContent","listenPodcasts","createPodcastDrafts","publishPodcasts","editPodcastMetadata","archivePodcastEpisodes","moderatePodcastEpisodes","managePodcastSeries","commentOnPodcasts","reactToPodcasts","moderatePodcastComments","managePodcastCommunity"];
for (const key of keys) {
  assert.ok(types.includes(`| \"${key}\"`) || types.includes(`  \"${key}\"`), `TypeScript registry missing ${key}`);
  assert.ok(migration.includes(`('${key}'`), `SQL registry missing ${key}`);
}

for (const marker of ["roles_community_system_key_unique","OWNER_ROLE_DELETE_FORBIDDEN","OWNER_ROLE_ASSIGNMENT_FORBIDDEN","ROLE_SELF_ASSIGNMENT_FORBIDDEN","ROLE_HIERARCHY_DENIED","PERMISSION_DELEGATION_DENIED","community_role_permissions","community_permission_overrides","effective_community_permission","scope_type in ('category','channel','radio_program','podcast_series')","enable row level security","revoke insert,update,delete on public.roles"]) assert.ok(migration.includes(marker), `Migration missing safeguard: ${marker}`);
for (const marker of ["community_permission_definitions","community_role_permissions","community_permission_overrides","system_key","permissions_version"]) assert.ok(databaseTypes.includes(marker), `Database types missing ${marker}`);
for (const marker of ["role grants enforce RLS","overrides enforce RLS","self-join and owner assignment trigger exists"]) assert.ok(rls.includes(marker), `pgTAP contract missing ${marker}`);

const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const permissions = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const role = (id, name, level, systemKey, capabilities = [], isDefault = false) => ({ id, name, level, color: "#000000", systemKey, capabilities, isDefault });
const roles = [role("owner","Owner",100,"owner"),role("admin","Admin",80,"admin"),role("moderator","Moderator",60,"moderator"),role("custom","Studio Lead",70,undefined,["manageRoles","sendMessages"]),role("member","Member",10,"member",[],true)];
const members = [
  ["owner-member","owner-user","owner"], ["admin-member","admin-user","admin"], ["custom-member","custom-user","custom"], ["mod-member","mod-user","moderator"], ["member-member","member-user","member"],
].map(([id,userId,roleId]) => ({ id,userId,roleId,displayName:userId,username:userId,avatarSeed:userId,status:"online",statusText:"" }));
const community = { id:"community",kind:"text",ownerId:"owner-user",name:"Community",icon:"C",accentColor:"#000000",visibility:"private",publicReadEnabled:false,categories:[],messages:[],roles,members };
const access = (userId) => permissions.getCommunityAccess(userId,community);
assert.equal(access("custom-user").status,"member","custom high-position role must not impersonate built-in Admin");
assert.ok(permissions.hasCommunityPermission(access("custom-user"),"manageRoles"),"custom explicit permission must be honored");
assert.ok(permissions.canAssignCommunityRole(access("custom-user"),community,members[3],roles[4]),"custom manager should assign lower roles");
assert.ok(!permissions.canAssignCommunityRole(access("custom-user"),community,members[1],roles[4]),"custom manager must not manage a higher role");
assert.ok(!permissions.canAssignCommunityRole(access("admin-user"),community,members[1],roles[4]),"Admin must not manage an equal role");
assert.ok(!permissions.canAssignCommunityRole(access("owner-user"),community,members[4],roles[0]),"Owner role must use ownership transfer");
assert.ok(!permissions.canDeleteCommunityRole(access("owner-user"),community,roles[4]),"occupied default Member role must not be deleted");
assert.ok(permissions.hasCommunityPermission(access("member-user"),"uploadAttachments") && permissions.hasCommunityPermission(access("member-user"),"addReactions") && permissions.hasCommunityPermission(access("member-user"),"joinVoice"),"Text member action permissions are incomplete");
const denied = permissions.resolveCommunityPermission(access("member-user"),"sendMessages",[{ type:"channel",id:"private" }],[{ roleId:"member",permission:"sendMessages",scope:{ type:"channel",id:"private" },effect:"deny" }]);
assert.equal(denied,false,"channel deny override must beat the base grant");
console.log("Community role hierarchy, canonical permissions, scoped overrides, RLS, and frontend parity smoke: PASS");
