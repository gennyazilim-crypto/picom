import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const source = await read("src/services/permissions/communityPermissions.ts");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const permissions = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const role = (id, name, level, capabilities = []) => ({ id, name, level, color: "#000", capabilities });
const roles = [role("owner", "Owner", 100), role("admin", "Admin", 80), role("moderator", "Moderator", 60), role("member", "Member", 10)];
const community = (kind, visibility = "public") => ({
  id: `${kind}-fixture`, kind, ownerId: "owner-user", name: kind, icon: kind[0], accentColor: "#000",
  visibility, publicReadEnabled: visibility === "public", categories: [], messages: [], roles,
  members: [
    { id: "m-owner", userId: "owner-user", roleId: "owner" },
    { id: "m-admin", userId: "admin-user", roleId: "admin" },
    { id: "m-mod", userId: "mod-user", roleId: "moderator" },
    { id: "m-member", userId: "member-user", roleId: "member" },
  ].map((member) => ({ ...member, displayName: member.userId, username: member.userId, avatarSeed: member.userId, status: "online", statusText: "" })),
});
const access = (userId, kind) => permissions.getCommunityAccess(userId, community(kind));
const can = (userId, kind, capability) => permissions.canPerformCommunityKindAction(access(userId, kind), capability);

assert(can("owner-user", "text", "manageTextCommunity"), "Text owner permission missing");
assert(can("admin-user", "text", "manageTextCommunity"), "Text admin permission missing");
assert(can("member-user", "text", "sendMessages"), "Text member send permission missing");
assert(!can("member-user", "text", "hostRadio"), "Text member received Radio capability");
assert(can("owner-user", "radio", "hostRadio"), "Radio owner host permission missing");
assert(can("admin-user", "radio", "manageRadioSchedule"), "Radio admin schedule permission missing");
assert(can("mod-user", "radio", "moderateRadioComments") && !can("mod-user", "radio", "hostRadio"), "Radio moderator boundary is wrong");
assert(can("member-user", "radio", "listenRadio"), "Radio member listen permission missing");
assert(can("visitor-user", "radio", "viewRadioContent") && !can("visitor-user", "radio", "listenRadio"), "Radio visitor read-only boundary is wrong");
assert(can("owner-user", "podcast", "publishPodcasts"), "Podcast owner publish permission missing");
assert(can("admin-user", "podcast", "archivePodcastEpisodes"), "Podcast admin archive permission missing");
assert(can("mod-user", "podcast", "moderatePodcastComments") && !can("mod-user", "podcast", "publishPodcasts"), "Podcast moderator boundary is wrong");
assert(can("member-user", "podcast", "commentOnPodcasts") && can("member-user", "podcast", "reactToPodcasts"), "Podcast member interaction permission missing");
assert(can("visitor-user", "podcast", "viewPodcastContent") && !can("visitor-user", "podcast", "commentOnPodcasts"), "Podcast visitor read-only boundary is wrong");
assert(!can("owner-user", "podcast", "sendMessages") && !can("owner-user", "radio", "publishPodcasts"), "Cross-kind frontend capability leaked");

const migration = await read("supabase/migrations/20260711000600_community_kind_permissions_rls.sql");
for (const marker of ["can_manage_community_kind", "can_view_community_kind_content", "enforce_community_kind_reference", "COMMUNITY_KIND_MISMATCH", "RADIO_CHANNEL_COMMUNITY_MISMATCH", "PODCAST_SERIES_COMMUNITY_MISMATCH", "createPodcastDrafts", "archivePodcastEpisodes", "commentOnPodcasts", "reactToPodcasts", "podcast_episode_status_permission"]) {
  assert(migration.includes(marker), `Kind permission migration is missing ${marker}`);
}
const rlsTest = await read("supabase/tests/rls/community_kind_permissions.sql");
for (const marker of ["Text owner", "Radio admin", "Radio moderator", "Podcast member", "Podcast visitor", "Visitor cannot read private Podcast metadata", "Text rejects Radio source rows"]) assert(rlsTest.includes(marker), `pgTAP matrix is missing ${marker}`);
const dataSource = await read("src/services/audio/audioDataSource.ts");
assert(dataSource.includes("ensureCommunityKind") && dataSource.includes("AUDIO_KIND_MISMATCH") && dataSource.includes("communityService.getCommunityKind"), "Audio service kind guard is missing");
const mockAudio = await read("src/data/mockAudio.ts");
assert(!mockAudio.includes('communityId: "aurora"') && mockAudio.includes('communityId: "picom-radio"') && mockAudio.includes('communityId: "picom-podcast"'), "Mock audio sources are not kind-compatible");
console.log("Community kind frontend matrix, service guards, source constraints, RLS policies, and role test contracts passed.");
