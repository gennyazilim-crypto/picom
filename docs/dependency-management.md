# Dependency Audit and Update Plan

Picom uses a small Electron + React + TypeScript stack with Supabase and LiveKit MVP integrations. Dependency changes should be deliberate, reviewed, and tested against the desktop shell before release.

## Current dependency areas

- Renderer: React, React DOM, TypeScript, Vite, `@vitejs/plugin-react`.
- Desktop runtime: Electron and electron-builder.
- Backend/service clients: `@supabase/supabase-js`.
- Voice and screen share: `livekit-client`.
- Development helpers: concurrently and wait-on.

## Audit commands

Run these locally before beta/stable release candidates:

```powershell
npm audit --audit-level=moderate
npm outdated
npm run typecheck
npm run qa:smoke
npm run qa:supabase
npm run build
```

Do not commit audit output if it contains local paths or private environment details.

## Update policy

- Prefer patch updates for security fixes.
- Review minor updates for Electron, Vite, Supabase, LiveKit, and TypeScript because they can affect runtime behavior.
- Treat major updates as planned engineering tasks with rollback notes.
- Do not run broad automatic upgrades without a dedicated task.
- Do not add large UI, charting, markdown, syntax highlighting, analytics, or plugin dependencies for placeholders.

Recurring patch updates follow `docs/dependency-update-train.md`. Dependabot opens bounded monthly patch PRs only; automatic minor/major updates and automatic merge are disabled. Electron, Supabase and LiveKit patches remain separate risk groups.

## Security response

1. Identify package, severity, exploitability, and affected runtime.
2. Check whether it affects renderer, Electron main/preload, build tooling, Supabase client, or LiveKit.
3. Apply the smallest safe version bump.
4. Run the quality gate.
5. Smoke test Electron dev mode when Electron/preload/runtime dependencies changed.
6. Document residual risk if no fixed version exists.

## Electron-specific checks

- Re-check `contextIsolation: true`.
- Re-check `nodeIntegration: false`.
- Re-check preload bridge surface.
- Re-check custom titlebar/window controls.
- Re-check packaging config for Windows, Linux, and macOS.

## Supabase-specific checks

- Confirm Supabase client changes do not alter auth/session restore assumptions.
- Confirm RLS remains the source of truth.
- Re-run Supabase static QA and any available local/staging RLS tests.
- Never add service-role keys or privileged credentials to renderer env variables.

## LiveKit-specific checks

- Confirm token Edge Function request/response shape remains compatible.
- Confirm voice room join/leave still works.
- Confirm screen share does not require unsafe renderer permissions.
- Never expose LiveKit API secrets in the renderer.

## Release checklist integration

Before shipping:

- No critical/high runtime vulnerabilities remain without documented exception.
- Electron runtime updates have been smoke-tested.
- Supabase and LiveKit client updates have been checked against MVP flows.
- Build artifacts are generated after dependency changes.
- Rollback path is documented for risky updates.

## Known limitations

- This plan works with `docs/secret-scanning.md` and `docs/dependency-vulnerability-policy.md` for CI/security review.
- `npm audit` can report build-only issues that require human triage.
- Some vulnerabilities may require waiting for upstream fixes.
