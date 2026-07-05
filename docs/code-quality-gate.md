# Code quality gate

Picom uses a lightweight, dependency-free quality gate for the Electron desktop MVP. The goal is to catch broken TypeScript, unsafe renderer patterns, logging redaction regressions, desktop-only regressions, packaging config drift, and mock-mode startup issues before task commits.

## Commands

Fast scoped gate:

```bash
npm run quality:fast
```

This runs:

- `npm run qa:smoke`
- `npm run typecheck`

Full checkpoint gate:

```bash
npm run quality:gate
```

This runs:

- `npm run qa:smoke`
- `npm run typecheck`
- `npm run build`

## When to use

Use `quality:fast` for:

- documentation changes that touch script references
- small TypeScript/service changes
- scoped smoke-test updates
- checkpoint validation before commit

Use `quality:gate` for:

- renderer UI changes
- Electron/preload/window-control changes
- Supabase service or realtime changes
- package/build config changes
- release candidate checkpoints

## Current scope

The gate intentionally avoids adding heavy tooling until the project is ready.

Included today:

- environment safety smoke checks
- QA output encoding smoke checks
- React hook order smoke checks
- logging and diagnostics redaction smoke checks
- error code smoke checks
- crash diagnostics smoke checks
- secret exposure smoke checks
- renderer native API smoke checks
- branding and desktop-only smoke checks
- Electron security smoke checks
- packaging config smoke checks
- LiveKit placeholder smoke checks
- mock mode smoke checks
- TypeScript typecheck
- production build in the full gate

Not included yet:

- ESLint config
- formatter check
- Playwright/Electron visual regression
- Supabase CLI-backed RLS tests
- dependency vulnerability scan in the default gate

## Quality rules

Task changes should preserve:

- no mobile UI
- no Discord branding, copied assets, or exact Discord colors
- no direct Electron/native APIs from React components
- no service-role keys or LiveKit secrets in renderer code
- no passwords, tokens, cookies, or authorization headers in logs
- no unsafe HTML rendering
- no direct mock/API switching inside presentational components
- no unrelated refactors inside scoped tasks

## Failure policy

If `quality:fast` or `quality:gate` fails:

- stop feature work
- fix the blocker first
- rerun the failed command
- document any remaining known issue in the task checkpoint

If a check cannot run locally because external tooling is missing, document the exact missing tool and manual verification path instead of claiming success.
