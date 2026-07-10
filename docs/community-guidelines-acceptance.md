# Community guidelines acceptance

Picom now gates the desktop public-community join confirmation when a community has rules enabled. The modal loads published rules through `communityRulesService`, labels required items, requires an explicit checkbox, and keeps visitors read-only until membership succeeds. Successful mock joins store the accepted timestamp and exact rules version locally; Supabase joins store a server timestamp and version atomically with membership.

The migration defaults `rules_enabled` to false so existing hosted communities are not unexpectedly blocked. Owners/operators may enable it only after publishing reviewed rules and advancing `rules_version`. Direct table policies permit owner/admin management, but Picom intentionally does not expose a rule editor until validation, version publishing, audit, and legal/product review are complete. Frontend checks are UX only; the security-definer join RPC is authoritative.

Discovery sends visitors to the community preview instead of bypassing consent. Private invite acceptance remains on the existing invite RPC and must not enable required rules until a version-aware invite preview/acceptance contract is deployed. This is an explicit safe-rollout limitation, not permission to bypass rules. Rule text must never include secrets, private moderation evidence, credentials, or member data; audit rows record only the join fact.

Hosted migration and RLS execution remain pending where the Supabase CLI/staging credentials are unavailable. Apply the migration in staging, publish synthetic rules, enable the switch, verify refusal without the current version, verify the server timestamp with the current version, and run owner/admin/member/visitor adversarial checks before production rollout.
