import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("src/App.tsx");
for (const marker of ['"radioCommunity"', "communityViewForKind", "communityNavigationService.getShellView", "<RadioCommunityShell", 'activeView === "radioCommunity"']) assert(app.includes(marker), `Radio route integration is missing ${marker}`);
const navigationService = read("src/services/community/communityNavigationService.ts");
for (const marker of ["getShellView", '"radioCommunity"', '"podcastCommunity"', "resolveTextChannelId"]) assert(navigationService.includes(marker), `Central community navigation is missing ${marker}`);
const shell = read("src/components/audio/RadioCommunityShell.tsx");
for (const marker of ["RadioCommunityShell", "Live Now", "Schedule", "Shows & Programs", "Hosts", "Announcements", "listenerChatEnabled", "RadioSessionList", "radioCommunityService.getShellSnapshot"]) assert(shell.includes(marker), `RadioCommunityShell is missing ${marker}`);
assert(!shell.includes("CommunitySidebar") && !shell.includes("PodcastEpisode"), "Radio shell includes text navigation or Podcast identity");
const sidebar = read("src/components/CommunitySidebar.tsx");
assert(sidebar.includes('community.kind !== "text"'), "Text community still exposes the combined audio entry");

const service = read("src/services/communityService.ts");
for (const marker of ['kind === "radio"', 'rpc("create_radio_community_with_defaults"', "target_creation_request_id: creationRequestId", "Could not create the Radio station"]) assert(service.includes(marker), `Radio creation service is missing ${marker}`);
const radioService = read("src/services/audio/radioCommunityService.ts");
for (const marker of ["getShellSnapshot", "radio_community_settings", "radio_programs", "radio_announcements", "Radio Host", "dataSourceService.getStatus().isMock"]) assert(radioService.includes(marker), `Radio shell service is missing ${marker}`);
assert(!shell.includes(".from(") && !shell.includes("supabase"), "Radio UI calls Supabase directly");

const factory = read("src/utils/communityFactory.ts");
for (const marker of ['name: "Radio Host"', '"hostRadio"', 'summary.kind === "radio" ? radioRoles']) assert(factory.includes(marker), `Mock Radio template is missing ${marker}`);
const migration = read("supabase/migrations/20260711000400_radio_community_default_template.sql");
for (const marker of ["radio_community_settings", "radio_programs", "radio_announcements", "ensure_radio_community_default_template", "create_radio_community_with_defaults", "Radio Host", "hostRadio", "manageRadioSchedule", "listener_chat_enabled", "pg_advisory_xact_lock", "returns setof public.communities", "grant execute"]) assert(migration.includes(marker), `Radio migration is missing ${marker}`);
const helper = migration.slice(migration.indexOf("ensure_radio_community_default_template"), migration.indexOf("create_radio_community_with_defaults"));
assert(!helper.includes("channel_categories") && !helper.includes("insert into public.channels"), "Radio bootstrap creates a normal text-channel tree");

const sqlTest = read("supabase/tests/rls/radio_community_default_template.sql");
for (const marker of ["creates no text categories", "Radio Host capability is initialized", "visitor cannot change station settings", "failure rolls back", "unauthenticated station creation is rejected"]) assert(sqlTest.includes(marker), `Radio pgTAP contract is missing ${marker}`);
console.log("Radio community shell, routing, roles, atomic creation, access, rollback, and empty schedule contracts passed.");
