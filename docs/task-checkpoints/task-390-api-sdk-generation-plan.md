# Task 390: API SDK Generation Plan

## Scope

Created a documentation-first API SDK generation strategy for Picom. This task intentionally avoids runtime code changes because the project does not yet have a stable OpenAPI contract for generated clients.

## Changed files

- `docs/api-sdk-generation.md`
- `scripts/api-sdk-generation-smoke-test.mjs`
- `docs/task-checkpoints/task-390-api-sdk-generation-plan.md`
- `package.json`

## Implementation notes

- Recommended the MVP-safe path: keep the manually maintained typed service layer and shared safe DTO package.
- Documented when to introduce an OpenAPI-generated client later.
- Documented DTO safety rules so renderer types never include secrets, token hashes, or backend-only fields.
- Added a focused smoke test that verifies the API SDK plan and shared type contract entry points exist.

## Verification commands

```bash
npm run api:sdk:smoke
npm run shared:types:check
npm run shared:types:smoke
npm run typecheck
npm run build
```

## Manual test notes

- No UI behavior changed.
- Existing MVP UI should remain stable.
- Future API SDK work should start from `docs/api-sdk-generation.md`.

## Remaining work

- Add an OpenAPI spec only after Edge Function/API endpoints stabilize.
- Add `generate:api-client` only after a generator is selected.
- Add endpoint-level contract tests before replacing current manual API wrappers.
