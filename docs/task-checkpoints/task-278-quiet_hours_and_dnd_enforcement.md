# Task 278 checkpoint: Quiet Hours and DND enforcement

## Completed

- Connected tray DND to the central notification routing policy.
- Added persistent community/channel mute state helpers.
- Added a persisted setting for whether mentions bypass muted scopes.
- Preserved Quiet Hours overnight handling, mention override, sounds-only behavior, and inbox routing.
- Ensured custom routing settings also control native silent behavior.
- Added a dependency-free enforcement smoke test because no unit-test framework is installed.

## Verification

- `npm run notifications:quiet-dnd:enforcement:test`
- `npm run notifications:quiet-hours:smoke`
- `npm run notifications:routing:smoke`
- `npm run notification-inbox:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Native Windows/Linux/macOS notification suppression should be manually checked during an active overnight Quiet Hours window and after changing tray status to DND. No native OS result is claimed by the static test.
