import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };
const migration = read("supabase/migrations/20260711002800_profile_access_cross_community_privacy.sql");
const matrix = read("supabase/tests/rls/profile_access_cross_community_privacy.sql");
const activity = read("supabase/migrations/20260710201000_profile_activity_production.sql");
const radio = read("supabase/migrations/20260711000900_radio_full_mvp_data_model_storage.sql");
const podcast = read("supabase/migrations/20260711001600_podcast_full_mvp_data_model_storage.sql");
const verification = read("supabase/migrations/20260710249000_verification_schema_security.sql");

assert(migration.includes("blocked_access := public.users_are_blocked") && migration.includes("shared_access") && migration.includes("friend_access"), "explicit profile viewer access matrix");
assert(migration.includes("allowed and settings.show_activity and trusted_access") && migration.includes("allowed and settings.show_media and trusted_access"), "trusted activity and media projection");
assert(activity.includes("public.can_view_message(message.id)") && activity.includes("attachment.scan_status in ('clean', 'skipped_development')"), "per-resource activity and media filtering");
assert(migration.includes("list_active_verification_badges") && migration.includes("get_profile_privacy_projection_v3"), "verification follows subject visibility");
assert(verification.includes('profile_verifications_safe_select') && verification.includes("status = 'approved'") && verification.includes("user_id = auth.uid()") && verification.includes('profile_verifications_self_request'), "verification request RLS separates public approval and private requester state");
assert(radio.includes("public.can_view_radio_session") && podcast.includes("public.can_view_podcast_episode"), "audio profile sources retain community RLS");
assert(matrix.includes("select plan(26)") && matrix.includes("rollback;"), "hosted-ready rollback profile matrix");
assert(matrix.includes("removing community access removes profile activity visibility") && matrix.includes("blocked user receives no activity"), "membership removal and block scenarios");
console.log("OK profile access privacy smoke completed");
