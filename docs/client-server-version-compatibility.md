# Client/Server Version Compatibility

Picom desktop clients must remain compatible with the Supabase backend and Edge Functions during beta and production rollout. This foundation uses remote config fields to decide whether the current desktop app version is supported, recommended to update, or blocked until update.

## Status

- Renderer service: `src/services/versionCompatibilityService.ts`
- Remote config source: `remoteConfigService`
- UI blocking screen: not implemented in this task
- Safe fallback: malformed or unavailable config does not block the app
- Secrets: none

## Remote config fields

The compatibility service reads these public fields:

- `minimumSupportedVersion`
- `recommendedClientVersion`
- `latestVersion`
- `releaseChannel`

These values are public compatibility metadata. They must not contain secrets, tokens, or private environment information.

## Compatibility states

- `supported`: current app version is greater than or equal to the recommended version.
- `update_recommended`: current app version is greater than or equal to minimum but lower than recommended.
- `update_required`: current app version is lower than minimum and should be blocked by future UI.
- `unknown`: config is malformed or cannot be compared; app continues with safe defaults.

## Safe fallback behavior

If remote config cannot be fetched:

1. use cached sanitized config if available
2. otherwise use local defaults
3. evaluate to `supported` or `unknown`
4. do not crash or lock users out because of missing config

The app should only block when a valid remote config clearly says the current version is below `minimumSupportedVersion`.

## Future UI integration

When UI is added later:

- `update_required` should show a blocking desktop update-required screen.
- `update_recommended` should show a non-blocking banner in the custom titlebar or settings.
- `supported` should show no banner.
- `unknown` can be logged and shown in diagnostics only.

The update flow should use `updateService` when production auto-update is implemented. This task does not enable real updater downloads.

## Backend/Supabase enforcement

Version compatibility is not an authorization mechanism. Supabase RLS, Edge Function auth checks, storage policies, and LiveKit token validation remain mandatory.

## Desktop rollout notes

- Version checks should be tested against Windows, Linux, and macOS packages.
- Backends should remain compatible with at least the minimum supported desktop version.
- Breaking API/schema changes must update `minimumSupportedVersion` only after release and rollback planning.

## Test steps

Run:

```bash
npm run version-compatibility:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

Manual checks:

1. Confirm `versionCompatibilityService.compareSemver()` handles `0.1.0` style versions.
2. Confirm malformed config evaluates to `unknown`, not an app crash.
3. Confirm remote config docs mention minimum/recommended/latest versions.
4. Confirm no UI behavior was changed in this task.
