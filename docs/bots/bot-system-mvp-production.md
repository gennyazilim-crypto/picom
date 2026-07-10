# Bot system MVP production foundation

## Product boundary

Picom has a safe community bot identity/credential foundation, not a public bot platform. Community Settings > Bots, visible `BOT` badges, role-scoped installations, one-time mock credential UX, backend credential schema, trusted issue/revoke RPCs, backend-only rate-limit counters, and audit hooks are prepared.

No public Bot API endpoint, marketplace, arbitrary/dynamic plugin code, renderer bot runtime, shell/filesystem/process/native access, or downloadable execution is enabled.

## Identity and installation

- `profiles.is_bot = true` and `bots.profile_id` create a dedicated non-human identity.
- `community_bots` installs that identity with a normal community `role_id`.
- The role must belong to the same community; trusted functions recheck the relation.
- Bot messages and member rows show a visible `BOT` badge.
- A bot has no implicit administrator access and cannot grant itself a role, permission, installation, or credential.
- Existing creation/installation INSERT remains unavailable to renderer clients. Production provisioning needs a separate trusted transaction that creates the profile/bot/install rows and validates role/owner.

## Manager and owner permissions

`can_manage_community_bots` requires community owner or a role level/`manageCommunity` grant. Credential issue/revoke additionally requires the authenticated caller to own the bot or be an app admin. A community admin may remove/manage an installation without gaining another developer's global bot credential.

Frontend button visibility is UX only. Every trusted RPC repeats authorization and installation/role ownership checks.

## Credential lifecycle

- Trusted SQL generates 32 random bytes, a non-secret prefix, and a `picom_bot_...` token.
- Raw token is returned once by `issue_community_bot_credential` and is never persisted.
- Database stores a SHA-256 hash, prefix, bot, creator, and lifecycle timestamps in backend-only `bot_credentials`.
- `anon`/`authenticated` have no table access; status RPC exposes prefix/timestamps/rate-limit label only, never hash.
- Only one active credential per bot exists; issue fails if one is active.
- Revocation is idempotent, sets `revoked_at`, and appends an audit event.
- Raw token, hash, Authorization header, secrets, message/command content, and private metadata are forbidden from logs, analytics, diagnostics, abuse events, audit reasons, DTOs, and UI after one-time display.

The current React UI intentionally keeps Supabase issue/revoke wiring disabled until live RLS/RPC tests and production provisioning are approved. Mock one-time behavior remains for desktop UX testing.

## Role-scoped actions

A future gateway must authenticate the token server-side, resolve the active credential/bot/community installation/role, and authorize each action against that role plus channel visibility and feature kill switches. Suggested initial capabilities are visible-channel metadata, bot-marked message send, own reactions, and bounded command metadata. No private channel access without the installed role permission.

The renderer must never authenticate bot requests or receive credential hashes/service-role secrets.

## Rate limits

`bot_action_rate_limits` is backend-only and partitions counters by credential/action. `consume_bot_action_rate_limit`:

- is executable only by `service_role`/trusted server context;
- rejects revoked/unknown credentials;
- validates bounded limit/window settings;
- updates atomically with conflict handling;
- returns allow/deny and bounded retry seconds;
- records counts only, not token, header, IP, command arguments, or message content.

Default policy is 60 requests/minute; message, reaction, event and command limits should be lower after load/abuse/cost review. Community slow mode and platform anti-abuse limits still apply.

## Audit and incident controls

Credential issue/revoke uses append-only community audit events with bot ID/action only. Installation/remove, role change, command registration, rate-limit abuse, failed authentication and privileged actions require equivalent bounded events when implemented. Emergency kill switches must reject new bot actions server-side, not merely hide UI.

## Manual verification

1. Confirm bot/member/message rows display `BOT` and ordinary users do not.
2. Member/moderator without manager permission cannot open/manage bot settings or call credential RPCs.
3. Manager who does not own a third-party bot cannot issue/revoke its credential.
4. Bot owner/app admin issues once; inspect response once, then verify table stores hash/prefix only and no subsequent read exposes raw/hash.
5. Second active issue fails; revoke works and appends redacted audit; revoked token is rejected by future gateway.
6. Rate-limit function is denied to authenticated clients and works only in isolated trusted test context.
7. Verify installed role cannot see private channels or perform actions beyond its permission set.
8. Search logs/network/diagnostics/export for raw token/hash/Authorization and verify absence.

## Remaining production blockers

- Trusted bot provisioning/installation transaction and UI wiring.
- Public gateway/token authentication with constant-time comparison/optional server pepper.
- Endpoint schemas, idempotency, role/RLS tests, slow mode, event filtering/backpressure, abuse ingestion, rotation, monitoring/on-call and incident runbook.
- Live Supabase CLI tests and external security review.
- Public developer access remains disabled until these pass.
