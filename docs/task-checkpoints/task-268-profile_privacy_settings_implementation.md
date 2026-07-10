# Task 268 checkpoint: Profile privacy settings implementation

- Completed Profile audience, online status, location, timezone, activity and media controls in Settings > Privacy & Safety.
- Added v2 owner settings/projection RPCs and a v3 profile activity boundary that removes hidden status before renderer delivery.
- Updated service mapping and ProfileView projection while preserving the existing mock/offline fallback.
- Revoked authenticated execution of the older activity payload and documented the remaining broad `profiles` SELECT/presence privacy gap honestly.
- No mobile UI or unrelated layout change was introduced.

Validation: `npm run profile:privacy:smoke`, `npm run profile:activity:supabase:smoke`, `npm run mock:smoke`, `npm run typecheck` and `npm run build` were run. Hosted RLS evidence remains pending because Supabase CLI/environment is unavailable.
