# Community guidelines acceptance

Picom gates the desktop public-community join confirmation when a community has rules enabled. Owners/admins edit up to ten published rules in Community Settings; the modal loads that current version through `communityRulesService`, labels required items, requires an explicit checkbox, and keeps visitors read-only until membership succeeds. Successful mock joins store the accepted timestamp and exact rules version locally; Supabase joins store a server timestamp and version atomically with membership.

The migration defaults `rules_enabled` to false so existing hosted communities are not unexpectedly blocked. Owners/admins may enable it only with at least one validated published rule and a safe rules version. The security-definer settings and join RPCs remain authoritative; frontend checks are UX only.

Owner-authored rule content remains subject to Picom legal and product-policy review; the editor must not be used to override platform safety, privacy, or statutory obligations.

Discovery sends visitors to the community preview instead of bypassing consent. Private invite acceptance remains on the existing invite RPC and must not enable required rules until a version-aware invite preview/acceptance contract is deployed. This is an explicit safe-rollout limitation, not permission to bypass rules. Rule text must never include secrets, private moderation evidence, credentials, or member data; audit rows record only the join fact.

Hosted migration and RLS execution remain pending where the Supabase CLI/staging credentials are unavailable. Apply the migration in staging, publish synthetic rules, enable the switch, verify refusal without the current version, verify the server timestamp with the current version, and run owner/admin/member/visitor adversarial checks before production rollout.
