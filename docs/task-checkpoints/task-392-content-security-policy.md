# Task 392: Content Security Policy

## Scope

Prepared the Content Security Policy plan for Picom without enforcing a runtime CSP yet. This keeps Vite dev mode and packaged Electron behavior stable while documenting the production target policy.

## Changed files

- `docs/content-security-policy.md`
- `scripts/content-security-policy-smoke-test.mjs`
- `docs/task-checkpoints/task-392-content-security-policy.md`
- `package.json`

## Implementation notes

- Documented packaged desktop CSP target directives.
- Documented separate local development CSP needs for Vite HMR.
- Confirmed current active renderer sources do not rely on unsafe HTML, iframes, or webviews.
- Added a smoke test that verifies CSP documentation and Electron navigation/content guards.

## Verification commands

```bash
npm run csp:smoke
npm run electron:security:smoke
npm run typecheck
npm run build
```

## Manual test notes

- No UI behavior changed.
- CSP is not enforced yet; before enabling it, run a packaged Electron smoke test to confirm boot, Supabase, LiveKit, local image previews, and external links still work.

## Remaining risks

- Production CSP enforcement remains a TODO.
- Supabase/LiveKit host allowlists need final environment-specific values.
- Attachment CDN/storage URL rules need to be aligned with the upload delivery plan.
