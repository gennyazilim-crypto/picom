# Picom Long-Term Architecture Review

## Executive assessment

Picom has a credible desktop-first architecture and strong security intent. Electron native access is isolated behind a sandboxed preload bridge, Supabase RLS is treated as the authorization boundary, LiveKit credentials remain server-side, and mock/API modes share service abstractions. The system is suitable for staged hardening, but continued feature growth inside the renderer root and stylesheet will raise regression risk unless boundaries are reduced deliberately.

Current scale indicators:

- `src/App.tsx`: roughly 2,100 lines and 100+ KiB.
- `src/styles.css`: roughly 4,100 lines and 200+ KiB.
- Electron main/preload: explicit IPC handlers and a frozen bridge with `contextIsolation`, `nodeIntegration: false`, and sandboxing.
- Supabase: 48 ordered migrations and multiple trusted Edge Functions.
- Realtime: community messages, typing, presence, and DMs use separate subscriptions.

## Strong areas

### Electron boundaries

- Renderer components do not import Electron or Node directly.
- Preload exposes a narrow, typed/frozen `picomDesktop` API instead of raw `ipcRenderer`.
- Main-process handlers validate payloads, constrain file types/sizes, normalize external URLs, block webviews/navigation, and keep the native menu disabled.
- Window state, deep links, notifications, tray, file dialogs, clipboard, and screen capture are centralized.

### Supabase and permissions

- Schema changes are ordered and additive, with RLS enabled on user/community/message/DM/platform tables.
- Public visitor reads, private channels, message ownership, attachments, reports, invites, events, saved messages, webhooks, and admin access have explicit policies.
- Components use service modules rather than direct `supabase.from` calls.
- Service-role and LiveKit signing secrets are not present in renderer code.

### Voice and screen share

- LiveKit token creation is isolated in an Edge Function.
- Voice state and screen-share capture are abstracted from React components.
- Electron desktop capture returns sanitized source metadata, not raw Electron objects.
- Join/leave/mute/deafen/share cleanup paths are centralized in `voiceService`.

### Product architecture

- Core community chat, Mention Feed, profile, DMs, friends, discovery, moderation, and settings are represented as explicit desktop views.
- Reusable permission helpers filter mock UX while RLS remains authoritative.
- Optimistic messages use stable IDs and realtime reconciliation foundations.
- Design tokens and AppIcon/Coolicons provide a coherent visual boundary.

### Operations

- Logging and diagnostics redact secrets and use bounded local buffers.
- QA scripts cover Electron safety, branding, desktop-only scope, hooks, mock/API boundaries, packaging configuration, migrations, RLS structure, and provider placeholders.
- Release, rollback, backup, incident, SLO, and provenance documentation already exists.

## Weak areas

1. `App.tsx` owns too many independent state machines, callbacks, services, overlays, and view routes.
2. `styles.css` is append-heavy; later overrides can silently supersede earlier task styles.
3. Some entities exist in multiple shapes across mock models, Supabase rows, shared DTOs, and component-local state.
4. Community and DM realtime paths use separate reconciliation implementations, increasing ordering and cleanup drift.
5. Several local-first services persist independent localStorage schemas without one migration/ownership registry.
6. Feature foundations and production-ready features live in the same component tree, so disabled/placeholder status can become unclear.
7. Supabase migration structural checks are strong, but real RLS execution is still environment-dependent.
8. Packaging scripts exist, but installed multi-platform evidence and update rollback are incomplete.
9. Bundle size shows optional features still entering the initial renderer path.
10. Provider integrations lack a unified lifecycle contract for disabled, degraded, consented, active, and failed states.

## Risky modules

| Module | Risk | Required control |
| --- | --- | --- |
| `src/App.tsx` | Hook-order and cross-view state regressions | Extract view controllers incrementally with characterization tests |
| `src/styles.css` | Cascade collisions and dead overrides | Layer tokens/base/layout/components/utilities and add style ownership rules |
| `src/services/voiceService.ts` | Media-track/listener leaks and reconnect edge cases | State-machine tests and explicit disposal ownership |
| Realtime hooks/services | Duplicate events, broad DM reaction subscriptions, stale updates | Shared event envelope, dedupe registry, scoped subscriptions, sequence checks |
| Permission/RLS migrations | Frontend/backend semantic drift | Generated permission matrix and negative pgTAP cases |
| Upload/storage flow | Client validation mistaken for trust | Server validation, quarantine, signed delivery, malware pipeline |
| Bot/webhook foundations | Credential abuse or unsafe execution if enabled early | Trusted server issuance, scopes, rate limits, audit, kill switches |
| Admin/moderation surfaces | Sensitive metadata exposure | App-admin RPC checks, community scope, redacted summaries |
| Local persistence services | Corrupt/stale schemas and privacy drift | Central registry, versioned migrations, TTL and clear ownership |
| Packaging/update | Broken or malicious update path | Signing, manifest verification, staged channels, rollback drill |

## Refactor candidates

Refactors should be incremental and behavior-preserving:

1. Introduce an `AppViewController` hook for active view, community/channel selection, profile return state, and guarded navigation.
2. Move overlay state/actions into a typed overlay controller while retaining the current visual components.
3. Split community chat, Mention Feed, profile, DMs, friends, discovery, and admin orchestration into feature controllers.
4. Consolidate message and DM optimistic/realtime reconciliation around a shared event envelope and reducer contract.
5. Normalize DTO mapping in service boundaries so components never consume database row shapes.
6. Create a local persistence registry with schema version, sensitive-data policy, TTL, migration, and clear behavior per key.
7. Split CSS into ordered layers without changing selectors or rendered layout.
8. Lazy-load heavy settings/admin/voice/profile/discovery surfaces.
9. Generate or test a single permission capability matrix against both TypeScript helpers and SQL policies.
10. Define provider interfaces for updater, crash reporting, analytics, email, storage scanning, and observability with safe disabled defaults.

## Domain review

### Messages, reactions, and replies

The current domain supports optimistic state, attachments, reactions, replies, deletion, sequence/order foundations, and realtime echoes. The long-term model should use one message event reducer with explicit precedence: deleted state wins over older updates, server sequence wins when present, and client IDs reconcile exactly once. Community and DM variants should share mechanics but retain separate authorization/storage tables.

### Mention Feed and Profile

These views correctly reuse community/member/message data and filter mock private-channel activity. Their future Supabase queries must remain server-filtered, paginated, and RLS-backed. Avoid building a second social-content database until message-derived feed limits are measured.

### Community permissions

Role-aware UI is mature enough for UX, but role levels and permission JSON require one canonical capability vocabulary. Owners/admins/moderators must be tested with negative cases, not inferred from labels. App-admin authorization must remain separate from community roles.

### Packaging and release

Electron Builder configuration, checksums, provenance, platform scripts, and rollback plans are good foundations. Production quality still depends on signing/notarization, installed artifact smoke tests, update-manifest verification, and rollback evidence.

### Diagnostics and logs

Central redaction and bounded storage are strong. Future remote transport must preserve local consent, sampling, payload allowlists, event-size caps, endpoint allowlists, and deletion/retention rules. Message content should never become a diagnostic default.

### Bot, webhook, and plugin extension points

Bots and webhooks should remain server-executed integrations with scoped identities and audited tokens. Desktop plugins must not be introduced as dynamic JavaScript loading. Any future plugin prototype requires a process/permission sandbox with no shell or unrestricted filesystem access.

## Next 10 technical priorities

1. Run all migrations and pgTAP RLS tests in disposable Supabase.
2. Establish a two-account realtime/integrity staging test harness.
3. Add sequence/dedupe/ordering tests shared by community messages and DMs.
4. Complete server-side attachment validation, scanning, quarantine, and signed delivery.
5. Split App navigation/overlay orchestration behind stable hooks.
6. Introduce CSS layers and remove superseded overrides with visual regression evidence.
7. Lazy-load optional surfaces and enforce bundle budgets.
8. Certify LiveKit voice/screen-share lifecycle across Windows, Linux, and macOS.
9. Complete signed package, update-manifest, rollout, and rollback drills.
10. Add production observability with explicit consent, redaction, budgets, and SLO ownership.

## What should not be built yet

- Arbitrary desktop plugin execution or dynamic code loading.
- Public bot marketplace before scoped bot credentials, quotas, audit, and abuse controls.
- Public webhook delivery before rate limits, replay/idempotency defenses, and kill switches.
- Production E2EE before an independent protocol/key-management review.
- Multi-region/data residency routing before backup, migration, and consistency procedures are proven.
- Billing, SSO/SCIM runtime, or enterprise admin runtime before the organization tenancy model is accepted.
- Mobile UI or mobile navigation.
- New social surfaces until current feed/profile privacy, pagination, and performance are production-tested.

## Decision

Preserve the current architecture while hardening it. Refactor only behind tests and in small ownership boundaries. Production evidence takes priority over new platform capabilities.
