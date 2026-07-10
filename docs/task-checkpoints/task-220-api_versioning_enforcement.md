# Task 220 checkpoint: API versioning enforcement

## Result

- Added centralized, public-safe API major/revision and minimum/recommended desktop version headers to every JSON Edge Function response.
- Added a backward-compatible request rule: missing API version remains accepted, while an explicit unsupported major returns the stable `VALIDATION_ERROR` shape.
- Desktop remote-config and LiveKit Edge calls now send API major and current Picom client version metadata.
- Kept `client-config` plus `versionCompatibilityService` as the blocking minimum-version source; headers do not weaken auth, RLS, permissions, or kill switches.
- Added CI contract enforcement and updated the deprecation policy.

## Compatibility

- No route, function name, request body, response body, RLS policy, UI, or public API was introduced.
- Previously released clients without version headers continue to work.
- A breaking future major requires a versioned path or compatibility adapter and the documented deprecation/removal gate.

## Validation

- `npm run api:versioning:enforcement:smoke`
- `npm run api:compatibility:smoke`
- `npm run version-compatibility:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
