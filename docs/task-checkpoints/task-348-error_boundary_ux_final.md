# Task 348 checkpoint: Error boundary UX final

## Completed

- Replaced technical fatal-screen copy with a clean desktop recovery explanation.
- Kept normal restart and Safe Mode restart actions.
- Added redacted support-log export and support-details copy actions.
- Added accessible action feedback and token-based light/dark styling.
- Limited stack-bearing developer diagnostics to development builds and kept them closed by default.
- Moved recovery-state clearing into the development-only diagnostics area.

## Safety

- Auth/session data is not cleared by restart or Safe Mode.
- Production users do not receive raw error messages, stacks, secrets or private content.
- Electron window controls, titlebar, chat and backend behavior are unchanged.

## Validation

- `npm run error-boundary:ux:audit`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
