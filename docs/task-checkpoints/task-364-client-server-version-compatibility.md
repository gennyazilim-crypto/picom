# Task 364 Checkpoint: Client/Server Version Compatibility

## Status

Completed typed client/server version compatibility foundation. No blocking update screen or updater behavior was added.

## Changed files

- `src/services/versionCompatibilityService.ts`
- `docs/client-server-version-compatibility.md`
- `scripts/version-compatibility-smoke-test.mjs`
- `docs/task-checkpoints/task-364-client-server-version-compatibility.md`
- `package.json`

## Commands run

```bash
npm run version-compatibility:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `src/services/versionCompatibilityService.ts`.
2. Confirm it compares semantic versions and returns `supported`, `update_recommended`, `update_required`, or `unknown`.
3. Confirm missing/malformed remote config cannot crash or block the app.
4. Run `npm run version-compatibility:smoke`.
5. Run `npm run typecheck && npm run qa:smoke && npm run build`.

## Notes

This foundation prepares the future update-required screen/banner, but does not change current MVP runtime UI.
