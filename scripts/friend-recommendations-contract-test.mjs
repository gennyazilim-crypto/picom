import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260904090000_friend_recommendations_engine.sql", "utf8");
const service = readFileSync("src/services/friends/friendRecommendationService.ts", "utf8");
const rail = readFileSync("src/components/FriendRecommendationsRail.tsx", "utf8");
const flags = readFileSync("src/services/featureFlagService.ts", "utf8");
const types = readFileSync("src/services/supabase/database.types.ts", "utf8");
const friendService = readFileSync("src/services/friends/friendRequestService.ts", "utf8");
const locales = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"]
  .map((locale) => [locale, readFileSync(`src/i18n/locales/${locale}/feed.json`, "utf8")]);

const checks = [
  [migration.includes("create table if not exists public.friend_recommendation_exposures"), "private exposure table exists"],
  [migration.includes("create table if not exists public.friend_recommendation_events"), "privacy-safe feedback event table exists"],
  [migration.includes("alter table public.friend_recommendation_exposures enable row level security") && migration.includes("revoke all on public.friend_recommendation_exposures from public, anon, authenticated"), "exposure storage is server-only"],
  [migration.includes("get_friend_recommendations") && migration.includes("viewer_id uuid := auth.uid()") && migration.includes("security definer") && migration.includes("set search_path=public,pg_temp"), "recommendation RPC derives the viewer on the server"],
  [migration.includes("safe_limit integer := least(greatest(coalesce(result_limit, 6), 1), 20)") && service.includes("const DEFAULT_LIMIT = 6") && service.includes("const SERVER_MAXIMUM = 20"), "sidebar default and server maximum are bounded"],
  [!migration.toLowerCase().includes("order by random()") && migration.includes("hashtextextended") && migration.includes("md5(scored.candidate_id::text || safe_seed)"), "exploration is deterministic and avoids random sort"],
  [migration.includes("public.can_send_friend_request(viewer_id, candidate.id)") && migration.includes("request.status = 'pending'") && migration.includes("not public.users_are_blocked(viewer_id, candidate.id)") && migration.includes("publisher_profile_is_active_account"), "relationship, block, pending-request, and account-safety exclusions are server authoritative"],
  [migration.includes("privacy.profile_visibility") && migration.includes("community.visibility = 'public'") && migration.includes("community.archived_at is null"), "profile and community privacy constraints are enforced"],
  [migration.includes("message.deleted_at is null") && migration.includes("message.channel_id") && !migration.includes("message.body"), "interaction affinity reads only public metadata, never message content"],
  [migration.includes("0::numeric as interest_score") && migration.includes("Picom does not currently expose a canonical public profile-verification"), "unavailable signals fail closed instead of inventing profile data"],
  [migration.includes("exposure.dismissed_at <= clock_timestamp() - interval '30 days'") && migration.includes("exposure.impression_count >= 3"), "dismiss and repeated-ignore suppression are present"],
  [migration.includes("community_rank <= 2") && migration.includes("fallback_selection"), "community diversity has a graceful fallback"],
  [migration.includes("friend_recommendation_refresh") && migration.includes("friend_recommendation_feedback"), "refresh and feedback rate limits are present"],
  [flags.includes('"FRIEND_RECOMMENDATIONS_ENABLED"') && flags.includes("FRIEND_RECOMMENDATIONS_ENABLED: false"), "feature flag defaults off"],
  [rail.includes("featureFlagService.isEnabled(\"FRIEND_RECOMMENDATIONS_ENABLED\")") && rail.includes("friendRecommendationService.list") && rail.includes("friendRecommendationService.dismiss"), "right sidebar uses the server recommendation contract only when enabled"],
  [friendService.includes('rpc("send_friend_request"') && rail.includes("onSendFriendRequest"), "existing friend-request workflow is reused"],
  [types.includes("get_friend_recommendations") && types.includes("dismiss_friend_recommendation"), "client RPC types are explicit"],
  [locales.every(([, contents]) => contents.includes("discover.friendRecommendations") && contents.includes("discover.friendRecommendationDismiss")), "all canonical UI locales include recommendation copy"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Friend recommendation contract failed: ${failed.join(", ")}`);
console.log(`Friend recommendation contract passed (${checks.length} checks; ${locales.length} locales).`);
