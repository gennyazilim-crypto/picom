# Task 408: Unified error code taxonomy

## Scope
- Hardened the centralized renderer error code taxonomy and documentation.
- No UI redesign, Electron shell behavior, Supabase schema, or LiveKit behavior changed.

## Completed
- Expanded `src/services/errorCodes.ts` with community, channel, message, permission, invite, and server error codes.
- Updated `scripts/error-codes-smoke-test.mjs` required code coverage.
- Created `docs/error-codes.md`.
- Confirmed `loggingService.formatUserError` remains wired to the unified formatter.

## Verification
- Run `npm run errors:smoke`.
- Run `npm run typecheck`.

## Manual test steps
1. Trigger or simulate an app/service error with a known code.
2. Confirm user-facing UI receives a friendly message.
3. Confirm developer diagnostics/logs remain redacted and separate from user UX.
4. Review `docs/error-codes.md` for expected backend/API error shape.
