# Task 374 - E2EE architecture document

## Result
- Added a documentation-only E2EE architecture plan.
- Explicitly states Picom does not currently provide production E2EE.
- Defines goals, non-goals, encrypted candidates, metadata exposure, key management, device trust, search/moderation limitations, attachment encryption placeholder, risks, and phased implementation.
- No runtime code, crypto code, dependencies, or UI behavior changed.

## Changed files
- `docs/e2ee-architecture.md`
- `scripts/e2ee-architecture-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-374-e2ee-architecture-document.md`

## Commands run
- `npm run e2ee:architecture:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual verification
1. Open `docs/e2ee-architecture.md`.
2. Confirm it is clearly marked as future/post-MVP.
3. Confirm it does not claim existing Picom messages are encrypted.
4. Confirm no code behavior changed.

## Remaining notes
- Any future E2EE work requires threat modeling, library selection, security review, recovery UX, and release-gate updates before implementation.
