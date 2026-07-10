# Production Feature Flags

## Purpose and status

Picom uses typed feature flags to control rollout availability for desktop features. The central `featureFlagService` supports immutable local defaults, renderer-safe build environment overrides, allowlisted remote config, development-only runtime overrides, subscriptions, source attribution, and safe unavailable copy.

Feature flags are not authorization. Supabase Auth/RLS, community membership, role permissions, private-channel checks, trusted Edge Functions, storage policies, LiveKit token authorization, and native IPC validation remain mandatory even when a flag is enabled.

## Production rollout map

| Product feature | Typed key | Safe local fallback |
| --- | --- | --- |
| Voice | `enableVoiceRooms` | Enabled; established desktop path, still permission/token controlled. |
| Screen share | `enableScreenShare` | Disabled pending rollout/platform gates. |
| Webhooks | `enableWebhooks` | Disabled pending backend enablement and security gates. |
| Bots | `enableBots` | Disabled; no public Bot API. |
| Discovery | `enableDiscovery` | Disabled until moderation/approval operations are ready. |
| Admin operations | `enableAdminOperations` | Disabled; role checks remain mandatory when enabled. |
| Auto-update | `enableAutoUpdate` | Disabled until signed provider rollout. |
| Analytics | `enableAnalyticsPlaceholder` | Disabled; user opt-in is additionally required. |

`PRODUCTION_FEATURE_FLAGS` is the typed product-name mapping. Existing flags for realtime, direct messages, friends, threads, polls, diagnostics, custom emoji, stickers, forum/announcement channels, saved messages, and the Developer Portal remain available to their existing rollout paths.

## Precedence

Highest precedence wins:

1. Development-only runtime override.
2. Sanitized remote config.
3. Renderer-safe build environment override.
4. Local default.

Runtime overrides are ignored in production. Snapshot source attribution reports `runtime`, `remote`, `environment`, or `defaults` accurately.

## Remote config compatibility

`remoteConfigService` reads only keys listed in `FEATURE_FLAG_KEYS` and only boolean values. Unknown keys and malformed values are ignored. Failed fetch uses the last sanitized cache; absent/corrupt cache falls back to safe local defaults. Remote payloads are public non-sensitive configuration and must never contain secrets, credentials, private operator data, or authorization rules.

Remote config may narrow or enable availability but cannot grant a permission, bypass RLS, change a role, expose a private channel, authorize LiveKit, or enable a backend route that is independently disabled. Critical backend features need their own enforcement/kill switch.

## UI and deep links

- Entry points use `shouldShowEntryPoint()` or kill-switch-aware availability helpers.
- A disabled deep link resolves to a compact unavailable state rather than mounting the feature.
- In-flight features should stop safely when their backend kill switch activates.
- Do not delete user data or auth state when a flag turns off.
- A flag failure must not prevent the core app shell, auth, community chat, or settings recovery UI from opening.

## Rollout procedure

1. Keep the local default off for risky features.
2. Verify backend authorization, RLS, observability, rollback, and platform tests in staging.
3. Enable for internal/beta release channels through reviewed remote config.
4. Monitor safe health/error metrics without private content.
5. Expand gradually; disable remote flag and activate backend kill switch on threshold breach.
6. Change local default only after stable rollout and release review.

## Verification

- `npm run feature-flags:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- Test unknown keys, non-boolean values, corrupt/missing cache, fetch timeout, source precedence, production runtime-override rejection, disabled deep links, and independent backend denial.

## Remaining risks

Not every existing UI entry point consumes every flag yet; each feature rollout must verify its UI, service, deep-link, and backend gates together. Remote config authenticity/transport relies on the configured HTTPS/Supabase deployment and must be included in production infrastructure review.
