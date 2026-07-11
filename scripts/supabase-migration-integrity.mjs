import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const directory = resolve("supabase/migrations");
const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
const prefixPattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const seen = new Set();
let previous = "";

for (const file of files) {
  const match = file.match(prefixPattern);
  if (!match) throw new Error(`Migration filename is not deterministic: ${file}`);
  if (seen.has(match[1])) throw new Error(`Duplicate migration order prefix: ${match[1]}`);
  if (previous && match[1] <= previous) throw new Error(`Migration order is not strictly increasing at ${file}`);
  seen.add(match[1]); previous = match[1];
  const contents = readFileSync(join(directory, file));
  if (contents[0] === 0xef && contents[1] === 0xbb && contents[2] === 0xbf) throw new Error(`UTF-8 BOM is forbidden in migration: ${file}`);
  const text = contents.toString("utf8");
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(text)) throw new Error(`Merge marker found in migration: ${file}`);
}

const requiredChain = [
  "20260711000100_community_kind_domain.sql",
  "20260711000400_radio_community_default_template.sql",
  "20260711000900_radio_full_mvp_data_model_storage.sql",
  "20260711001600_podcast_full_mvp_data_model_storage.sql",
  "20260711002000_friendship_schema_rls_privacy_foundation.sql",
  "20260711002300_direct_messages_schema_rls_completion.sql",
  "20260711002600_profile_schema_privacy_services_full_mvp.sql",
  "20260711003000_unified_feed_query_ranking_pagination.sql",
  "20260711148400_user_settings_persistence.sql",
  "20260711149200_community_role_permission_schema_completion.sql",
  "20260711149500_type_aware_community_structure_management.sql",
  "20260711150100_livekit_token_authorization.sql",
  "20260711150600_voice_screen_permissions_moderation.sql",
  "20260711150900_auth_profile_onboarding_production.sql",
  "20260711151000_text_community_messaging_integration.sql",
  "20260711151100_audio_production_integration.sql",
];
let lastIndex = -1;
for (const required of requiredChain) { const index = files.indexOf(required); if (index < 0) throw new Error(`Required Full MVP migration is missing: ${required}`); if (index <= lastIndex) throw new Error(`Full MVP migration chain is out of order: ${required}`); lastIndex = index; }

console.log(`Supabase migration integrity passed (${files.length} uniquely ordered, BOM-free migrations).`);
