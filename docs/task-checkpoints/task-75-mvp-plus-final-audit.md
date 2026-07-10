# Task 75 Checkpoint: MVP+ Final Audit

## Readiness decision

**Ready with non-blockers for an internal/staging beta candidate.** The source tree, mock mode, Electron security configuration, Supabase API structure, feature smoke tests, typecheck, and production build are healthy. Picom is **not yet approved for a public production rollout** until the environment-dependent release gates below are completed.

## Critical blockers

No source, TypeScript, mock-startup, Electron configuration, or production-build blocker was found.

Production promotion remains blocked by external verification rather than a known code failure:

1. Install Supabase CLI, apply migrations `00100` through `04800` to a disposable/staging project, and execute the real pgTAP/RLS suite.
2. Run two-account/two-window staging tests for DMs, private-channel boundaries, invites, reports, events, realtime reconciliation, and session changes.
3. Build, install, launch, update/uninstall-smoke the release candidate on Windows, Linux, and macOS as applicable.

## MVP+ feature audit

| Area | Status | Notes |
| --- | --- | --- |
| Direct Messages | Implemented | Schema/RLS, desktop UI, optimistic messaging, reactions/attachments foundation, and realtime reconciliation exist. |
| Friends, follow, privacy | Implemented | Relationship and blocking services exist with Supabase-backed boundaries. |
| Notification Center | Implemented | Desktop inbox/routing foundation exists; native delivery remains preference/runtime dependent. |
| Advanced Search | Implemented | Local and Supabase queries rely on visible rows; private mock channels are filtered. |
| Saved Messages | Implemented | Owner-only records re-check message visibility. |
| Drafts | Implemented | Local per-destination text drafts avoid persisting raw files or secrets. |
| Events | Implemented | UI/service/RLS exist; Task 74 hardened linked-channel visibility. |
| Discovery | Implemented | Only public, readable, explicitly listed communities are queried. |
| Invites | Implemented | Expiry, revocation, bans, max-use locking, and authenticated acceptance are present. |
| Reports and moderation | Implemented | Queue, target validation, role-gated review fields, filters, and message trigger exist. |
| Audit log UI | Implemented | Permission-gated read/export with append-only RPC foundation. |
| Bots | Foundation | Metadata/role foundation only; no runtime, marketplace, or raw bot token. |
| Webhooks | Foundation | One-time token display and hash storage exist; production delivery is intentionally disabled. |
| Slash commands | Foundation | Compact local command registry/UI; no plugin runtime. |
| Custom emoji and stickers | Foundation | Safe metadata/UI path; production media lifecycle remains future work. |
| Polls | Implemented foundation | Local/API-capable poll creation and voting structure exists. |
| Threads | Implemented foundation | Thread panel/messages structure exists without disrupting main chat. |
| Forum and announcement channels | Foundation | Structural views and restricted-posting path exist. |
| Admin operations | Implemented foundation | App-admin RPC boundary and restricted desktop panel exist. |
| Analytics | Privacy placeholder | Disabled by default; no provider or sensitive content collection. |
| Auto-update | Beta foundation | State/UI/service abstraction exists; production provider remains disabled. |
| Crash reporting | Privacy placeholder | Redacted local diagnostics exist; remote provider remains disabled. |
| Data export/deletion | Implemented request foundation | Backend request rows, exact confirmation, owner transfer guard, and no renderer hard-delete. |
| Security hardening | Completed for source audit | RLS, secrets, links, IPC, uploads, logs, visitor/private data, and token surfaces reviewed. |

## Non-blockers

- The renderer bundle emits Vite's `>500 kB` warning: main JS is about 941 kB minified, LiveKit chunk about 477 kB, and the current logo asset about 752 kB.
- Bot execution, webhook delivery, production updater, remote analytics/crash providers, and background export processing are intentionally disabled or placeholder-only.
- Some advanced surfaces are local-first and require two-account staging validation before enabling broadly.
- Supabase structural smoke passes, but live pgTAP execution is skipped because the CLI is unavailable on this workstation.

## Security concerns and boundaries

- Never enable service-role or LiveKit signing secrets in renderer environment variables.
- Treat mock filtering as UX only; production privacy depends on applied RLS migrations.
- Keep webhook delivery disabled until server-side rate limiting, abuse monitoring, and delivery audit are complete.
- Client image signatures are defense in depth; production storage still needs trusted decoding and malware scanning.
- Do not activate updater, analytics, or crash providers without endpoint allowlists, redaction review, consent, and rollout controls.

## Recommended next release tasks

1. Run migration reset and real RLS tests in disposable Supabase, then repeat on staging.
2. Execute a two-window/two-account staging matrix covering private data and realtime flows.
3. Produce and manually smoke-test Windows, Linux, and macOS release candidates.
4. Code-split optional settings/admin/voice surfaces and optimize the large logo asset.
5. Complete a release go/no-go using staging evidence; keep placeholder providers disabled if not approved.

## Commands run

- `npm run qa:smoke`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run supabase:api-regression`
- `npm run supabase:rls:smoke`
- `npm run electron:security:smoke`
- `npm run desktop:ipc:security:smoke`
- `npm run external-links:smoke`
- `npm run secrets:smoke`
- Feature smokes for privacy, saved messages, drafts, events, moderation, bots, webhooks, slash commands, emoji, stickers, polls, threads, forum, announcement channels, analytics, crash reporting, and compliance workflows
- `node scripts/mvp-plus-security-smoke-test.mjs`
- `npm run package:verify`
- `npm run bundle:size:smoke`
- `npm run typecheck`
- `npm run build`

## Test result

All executed static, mock, security, Electron configuration, API regression, typecheck, and build checks passed. Vite reported only the known bundle-size warning. Supabase RLS structure passed, while real CLI-backed pgTAP execution was skipped and remains a production release gate.
