import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function assertContains(relativePath, needle, label) {
  const contents = read(relativePath);
  if (!contents.includes(needle)) {
    throw new Error(`${label} not found in ${relativePath}`);
  }

  console.log(`OK ${label}`);
}

function assertFile(relativePath, label) {
  if (!existsSync(join(root, relativePath))) {
    throw new Error(`${label} missing: ${relativePath}`);
  }

  console.log(`OK ${label}`);
}

function listFiles(relativePath, matcher, acc = []) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return acc;

  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const childRelativePath = `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) {
      listFiles(childRelativePath, matcher, acc);
    } else if (matcher.test(entry.name)) {
      acc.push(childRelativePath);
    }
  }

  return acc;
}

function assertNoContainsInFiles(relativePaths, pattern, label) {
  for (const relativePath of relativePaths) {
    const contents = read(relativePath);
    if (pattern.test(contents)) {
      throw new Error(`${label} found in ${relativePath}`);
    }
  }

  console.log(`OK ${label} not found`);
}

try {
  assertFile("supabase/config.toml", "Supabase config");
  assertFile("src/services/supabase/database.types.ts", "Supabase database types");
  assertFile("src/lib/supabaseClient.ts", "Supabase client compatibility entrypoint");
  assertFile("src/services/profileService.ts", "profile service");
  assertFile("src/services/supabase/authService.ts", "Supabase auth service namespace");
  assertFile("src/services/supabase/profileService.ts", "Supabase profile service namespace");
  assertFile("src/services/supabase/communityService.ts", "Supabase community service namespace");
  assertFile("src/services/supabase/channelService.ts", "Supabase channel service namespace");
  assertFile("src/services/supabase/messageService.ts", "Supabase message service namespace");
  assertFile("src/services/supabase/uploadService.ts", "Supabase upload service namespace");
  assertContains("src/services/dataSourceService.ts", "supabase", "data source Supabase mode");
  assertContains("src/services/authService.ts", "signInWithPassword", "Supabase auth sign-in path");
  assertContains("src/services/authService.ts", "getCurrentSession", "Supabase session restore path");
  assertContains("src/services/profileService.ts", '.rpc("get_profile_domain_v1"', "privacy-projected profiles read API path");
  assertContains("src/services/profileService.ts", '.rpc("update_own_profile_domain"', "owner-scoped profiles write API path");
  assertContains("src/services/communityService.ts", ".from(\"communities\")", "communities API path");
  assertContains("src/services/channelService.ts", '.rpc("create_managed_text_channel"', "authoritative Text channel creation API path");
  assertContains("src/services/messageService.ts", "listMessages", "messages list service path");
  assertContains("src/services/messageSendMutation.ts", '.rpc("send_text_message_idempotent"', "idempotent Text message send API path");
  assertContains("src/services/uploadService.ts", ".storage", "Supabase storage upload path");
  assertContains("src/services/attachmentService.ts", ".from(\"attachments\")", "attachment metadata API path");
  assertContains("src/services/membersService.ts", ".from(\"community_members\")", "members API path");
  assertContains("src/services/reactionService.ts", 'rpc("set_message_reaction"', "aggregate-safe reactions API path");
  assertContains("src/services/supabase/realtimeService.ts", "postgres_changes", "Supabase realtime postgres_changes path");
  assertContains("src/services/audio/audioDataSource.ts", 'client.from("radio_sessions")', "Radio Supabase repository path");
  assertContains("src/services/audio/audioDataSource.ts", 'client.from("podcast_episodes")', "Podcast Supabase repository path");
  assertContains("src/services/audio/podcastPublishingService.ts", "client.storage.from(bucket)", "Podcast private Storage path");
  assertContains("src/hooks/useAudioCatalog.ts", "radioRealtimeService.subscribe", "Radio Realtime lifecycle path");
  assertContains("src/hooks/useAudioCatalog.ts", "podcastRealtimeService.subscribe", "Podcast Realtime lifecycle path");
  assertContains("src/services/friends/friendRequestService.ts", 'rpc("send_friend_request"', "Friends Supabase lifecycle path");
  assertContains("src/services/supabase/directMessageService.ts", 'rpc("send_direct_message_v3"', "atomic Direct Message send path");
  assertContains("src/services/directMessages/directRealtimeService.ts", "direct_message_attachments", "Direct Message Realtime attachment path");
  assertContains("src/services/feed/feedQueryService.ts", '.rpc("list_ranked_unified_feed"', "unified Feed Supabase query path");
  assertContains("src/services/feed/feedQueryService.ts", "const fetchLimit = limit + 1", "unified Feed exact pagination look-ahead");
  assertContains("src/services/feed/feedRealtimeService.ts", '"audio_feed_read_states"', "unified Feed audio state Realtime path");
  assertContains(".env.example", "VITE_SUPABASE_URL", "Supabase URL env example");
  assertContains(".env.example", "VITE_SUPABASE_ANON_KEY", "Supabase anon key env example");
  assertContains(".env.example", "SUPABASE_SERVICE_ROLE_KEY", "server-only service role env documentation");
  assertContains("src/App.tsx", "communityService.listCommunities", "ServerRail Supabase data load");
  assertContains("src/App.tsx", "channelCategoryService.listCategories", "CommunitySidebar Supabase category load");
  assertContains("src/App.tsx", "messageService.listMessages", "MessageList Supabase data load");
  assertContains("src/App.tsx", "membersService.listMembers", "MemberSidebar Supabase data load");
  assertFile("supabase/migrations/20260704001600_communities_rls.sql", "communities RLS migration");
  assertFile("supabase/migrations/20260704001800_channels_rls.sql", "channels RLS migration");
  assertFile("supabase/migrations/20260704001900_messages_rls.sql", "messages RLS migration");
  assertFile("supabase/migrations/20260704002100_reactions_rls.sql", "reactions RLS migration");
  assertFile("docs/supabase-integration.md", "Supabase integration documentation");
  assertNoContainsInFiles(
    listFiles("src/components", /\.(ts|tsx)$/).concat(["src/App.tsx"]),
    /\.from\("/,
    "direct Supabase table calls in UI components",
  );
  assertNoContainsInFiles(
    listFiles("src", /\.(ts|tsx)$/),
    /VITE_SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|service_role_key|serviceRoleKey/i,
    "service-role key reference in renderer source",
  );
  console.log("OK Supabase API mode regression test completed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
