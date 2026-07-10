# Task 337 - Mobile strategy reassessment

Status: completed as documentation-only analysis; mobile remains deferred.

## Outcome

- Reaffirmed Windows/Linux/macOS Electron as Picom's current product focus.
- Compared possible mobile implementation approaches without selecting or scaffolding one.
- Documented Supabase, LiveKit, shared-contract and UI/service reuse boundaries.
- Defined cost drivers, prerequisites, discovery stages and explicit non-goals.
- Added no mobile UI, responsive route, native project or runtime code.

## Validation

This task changes Markdown only. `npm run typecheck`, `npm run mock:smoke` and `npm run build` were skipped under the documentation-only task allowance because runtime code, dependencies and build configuration are unchanged.

## Remaining decision

Mobile requires a separate product approval, measurable demand, funded ownership, native technical spikes and platform-specific release/security review. It remains out of scope until those gates pass.

