# Picom MVP+ Scope Lock

## Status

**Locked for implementation by the approved Tasks 46-75 pack.** MVP+ development may proceed one task at a time, but this authorization does not change the current stable release decision in `docs/stable-go-no-go.md`. Stable publication remains blocked until its external, native, security, legal, and operational evidence is complete.

## Product direction

- Electron desktop app for Windows, Linux, and macOS only.
- Preserve Picom custom chrome, premium desktop density, design tokens, light/dark themes, and Coolicons/AppIcon.
- Supabase remains the Auth/Postgres/RLS/Storage/Realtime/Edge boundary.
- LiveKit remains the approved voice and screen-share boundary.
- Backend and RLS authorization remain authoritative; UI gating is UX only.
- No mobile or browser-first layout.

## Branch strategy

- `main`: stable, reviewed integration history and release-ready checkpoints.
- `develop`: active MVP+ integration after task-level validation.
- `feature/task-<number>-<slug>`: one bounded task at a time.
- `release/<version>`: immutable release-candidate stabilization only.

Each task requires a checkpoint, relevant tests, a task-scoped commit, and review before promotion. Urgent P0 security or data-loss fixes may interrupt the queue but must remain isolated.

## Included Tasks 46-75

- Direct Messages schema, RLS, desktop UI, realtime, unread, and notification foundations.
- Friends/follow hardening and privacy controls including user blocking.
- Advanced notification center and access-safe search.
- Saved messages and per-channel/per-DM drafts.
- Community events, discovery, and invite onboarding polish.
- Reports, moderation queue/filters, and audit-log UI/export.
- Constrained bot, webhook, and built-in slash-command foundations.
- Community custom emoji, local stickers, polls, threads, forum, and announcement channel foundations.
- Restricted app-level operations panel.
- Privacy-friendly analytics abstraction with no provider by default.
- Beta auto-update architecture without production credentials or endpoint.
- Disabled-by-default crash-reporting abstraction.
- User data export and deletion-request workflows.
- MVP+ security hardening and final audit.

## Explicit exclusions

- Mobile application or mobile UI.
- Enterprise SSO, SCIM, billing, or enterprise control plane.
- Plugin runtime capable of executing arbitrary code.
- Production E2EE rollout or encryption claims.
- Public bot/plugin marketplace.
- Production analytics provider without privacy/legal approval.
- Production auto-update rollout before signing, metadata, rollback, and channel gates pass.
- Discord branding, logos, copied assets, icons, or exact colors.

## Cross-cutting definition of done

- Safe schema and forward-only migration where data changes are required.
- RLS tests or honest static/runbook evidence when live Supabase is unavailable.
- No service-role, LiveKit, webhook, bot, updater, or provider secrets in renderer code.
- Access-safe search/feed/profile/activity and attachment behavior.
- Mock mode and Supabase mode remain usable.
- No regressions to titlebar, Mention Feed, ProfileView, community chat, voice, or packaging.
- Typecheck, relevant smoke checks, production build, checkpoint, and task commit.

## Release boundary

MVP+ completion is not a stable-release approval. A new Go/No-Go review must separately close live Supabase/RLS, private attachment signed-URL reload, LiveKit/native tests, target-platform packaging/signing, restore-drill, and legal/privacy blockers.
