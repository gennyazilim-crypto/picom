# Task 086 Checkpoint: Crash Reporting Provider

## Outcome

Converted Picom's local crash-reporting placeholder into an optional provider-ready abstraction while keeping external delivery disabled.

## Changes

- Added the canonical provider interface under `src/services/diagnostics/`.
- Preserved the existing service import path through a compatibility re-export.
- Kept the existing Desktop startup ErrorBoundary integration intact.
- Added bounded local storage, non-fatal provider delivery, coarse anonymous/authenticated context, and shared diagnostic redaction.
- Documented provider privacy, Electron, secret-management, and production enablement boundaries.

## Safety

- No provider SDK, DSN, endpoint, token, service-role key, or LiveKit secret was added.
- Reporting remains disabled by default.
- Provider failures cannot block Picom startup or core app behavior.
- Existing renderer callers continue to use the same service import.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
