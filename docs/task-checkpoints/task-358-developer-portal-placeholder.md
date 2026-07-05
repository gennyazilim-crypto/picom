# Task 358 Checkpoint: Developer Portal Placeholder

## Status

Completed as a documentation-first post-MVP placeholder. No runtime UI or backend route was added, so the current MVP desktop shell remains unchanged.

## Changed files

- `docs/developer-portal-placeholder.md`
- `scripts/developer-portal-placeholder-smoke-test.mjs`
- `docs/task-checkpoints/task-358-developer-portal-placeholder.md`
- `package.json`

## Commands run

```bash
npm run developer-portal:placeholder:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `docs/developer-portal-placeholder.md`.
2. Confirm the portal is marked as post-MVP and hidden from normal users.
3. Confirm no real API keys, bot tokens, or secrets are documented.
4. Run `npm run developer-portal:placeholder:smoke`.
5. Run the normal QA gate before release: `npm run typecheck && npm run qa:smoke && npm run build`.

## Notes

The future Developer Portal should be guarded by backend authorization and a feature flag. Frontend hiding alone must not be treated as security.
