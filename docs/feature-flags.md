# Feature Flags Foundation

Picom uses feature flags to hide or disable risky, unfinished, or post-MVP functionality without deleting code. Feature flags are an availability and rollout tool, not a security boundary.

## Status

- Runtime service: `src/services/featureFlagService.ts`
- External provider: none
- Remote config: prepared through a safe allowlist method
- Secrets: not allowed in feature flag payloads
- MVP UI: unchanged

## Typed keys

The current typed keys are:

- `enableRealtime`
- `enableVoiceRooms`
- `enableDirectMessages`
- `enableFriends`
- `enableDiscovery`
- `enableBots`
- `enableWebhooks`
- `enableThreads`
- `enablePolls`
- `enableAdvancedModeration`
- `enableDiagnostics`
- `enableAutoUpdate`
- `enableAnalyticsPlaceholder`
- `enableDeveloperPortal`
- `enableCustomEmoji`
- `enableStickers`
- `enableForumChannels`
- `enableAnnouncementChannels`
- `enableSavedMessages`

## Defaults

MVP-critical or already-established areas can default on:

- realtime foundation
- voice rooms
- diagnostics in non-production builds

Post-MVP capabilities default off:

- bots
- webhooks
- plugins/developer portal
- discovery
- threads
- polls
- advanced moderation
- analytics placeholder
- auto update

If remote config is unavailable, the service falls back to local defaults and the existing MVP remains usable.

## Environment override

Renderer-safe local overrides can be provided with:

```env
VITE_FEATURE_FLAGS=enableDiscovery=false,enableBots=false
```

JSON is also supported for local/development use:

```env
VITE_FEATURE_FLAGS={"enableDiagnostics":true,"enableDeveloperPortal":false}
```

Never place secrets in `VITE_FEATURE_FLAGS`. Vite variables are bundled into the renderer and must be treated as public configuration.

## Remote config rules

Future remote config may call:

```ts
featureFlagService.applyRemoteConfig({ enableDiscovery: false });
```

The service will:

- accept only known typed feature flag keys
- accept only boolean-like values
- ignore unknown keys
- ignore malformed values
- keep MVP defaults if config fails

Remote config must never include:

- Supabase service role keys
- LiveKit secrets
- signing keys
- auth tokens
- passwords
- private admin configuration

## UI behavior

UI code should use:

```ts
featureFlagService.shouldShowEntryPoint("enableDiscovery")
```

or:

```ts
featureFlagService.getAvailability("enableDiscovery")
```

For features that may need emergency rollout shutdown, use the kill-switch-aware helper instead:

```ts
emergencyKillSwitchService.getFeatureAvailability("enableRealtime")
```

Disabled features should show one of these safe behaviors:

- entry point hidden
- compact unavailable state
- toast or inline copy explaining temporary unavailability

Deep-linked disabled features should fail safe and never bypass backend authorization.

## Security model

Feature flags must not be the only security control.

Backend/Supabase must still enforce:

- authentication
- RLS policies
- community membership
- private channel access
- role permissions
- storage access controls
- LiveKit token authorization

## Test steps

Run:

```bash
npm run feature-flags:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

Manual checks:

1. Confirm `VITE_FEATURE_FLAGS` is documented as renderer-safe only.
2. Confirm post-MVP flags default off.
3. Confirm unknown remote config keys are ignored by the service.
4. Confirm no UI entry points were added in this task.
