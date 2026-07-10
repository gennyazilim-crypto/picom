# Picom Post-MVP+ Phase Plan

## Governance status

This document is the source of truth for work after Task 75. Picom is ready for internal/staging beta validation, but public production promotion remains gated by live RLS execution, multi-account realtime testing, and installed desktop-package certification.

New work must satisfy these rules:

- Preserve the Windows, Linux, and macOS Electron desktop direction. No mobile UI.
- Keep Supabase RLS, trusted Edge Functions, and minimal Electron preload IPC as security boundaries.
- Do not activate providers, public APIs, bot execution, webhooks, marketplace publishing, or enterprise controls without their named security and rollout gates.
- Complete production-hardening evidence before expanding product surface area.
- Every task receives a checkpoint, relevant automated checks, a focused commit, and a push.

## Shipped baseline

### Full MVP

- Secure Electron shell, custom titlebar, desktop window controls, tray/startup foundations, and packaged-build configuration.
- Premium four-column community chat, Mention Feed, full profile view, settings, overlays, light/dark themes, Coolicons/AppIcon, and local mock mode.
- Supabase auth, profiles, communities, channels, messages, attachments, reactions, membership/roles, RLS, storage, realtime foundations, and LiveKit voice/screen-share paths.
- Message composition, optimistic send, edit/delete/reactions/replies, upload validation, image preview, member search, role-aware community management, and visitor read-only behavior.

### MVP+

- Direct Messages, friends/follow/privacy blocking, Notification Center, advanced search, saved messages, drafts, events, discovery, hardened invites, reports, moderation filters, and audit-log UI/export.
- Safe foundations for bots, webhooks, slash commands, custom emoji/stickers, polls, threads, forum/announcement channels, and app-admin operations.
- Privacy-safe analytics, updater and crash-reporting abstractions, export/deletion requests, and the Task 74 security-hardening migration.

## Release blockers

1. Apply migrations `00100` through `04800` in disposable/staging Supabase and run real pgTAP/RLS tests.
2. Complete two-account/two-window tests for DMs, private channels, invites, reports, events, realtime ordering, presence, and session revocation.
3. Build, install, launch, and uninstall-smoke Windows, Linux, and macOS release candidates where supported.
4. Verify backup/restore and incident-response drills before production data is accepted.

## Non-blockers and technical debt

- Main renderer and LiveKit chunks exceed the preferred bundle threshold; optional surfaces need code splitting.
- The current logo asset is oversized for startup delivery.
- Several MVP+ surfaces are local-first or foundation-only.
- Supabase CLI is absent on the current workstation, so structural tests pass but live RLS execution is pending.
- Production updater, analytics, crash reporting, bot runtime, and webhook delivery remain disabled.
- Attachment magic-byte checks are client defense in depth; trusted server scanning and decoding remain pending.

## Postponed features

- Public bot/plugin marketplace and arbitrary plugin runtime.
- Production E2EE.
- Mobile applications and mobile navigation.
- Billing, public enterprise administration, SSO/SCIM runtime, legal hold enforcement, and regional data routing until their designs and security reviews are accepted.
- Public discovery expansion until moderation review and abuse controls are operational.

## Workstreams

### 1. Production hardening

Priority: P0.

- Supabase migration dry run, RLS regression suite, realtime integrity, performance/virtualization, backups, restore drills, penetration testing, rate limits, storage delivery, scanning/quarantine, and audit immutability.
- Exit gate: repeatable staging evidence with no unresolved cross-tenant or data-loss blocker.

### 2. Distribution and update

Priority: P0 after core hardening.

- Code signing, notarization, Linux distribution, release channels, update manifests, rollback, staged rollout, and cross-platform screen-share certification.
- Exit gate: installed package smoke evidence and a tested rollback path per platform.

### 3. Trust and safety

Priority: P1.

- Moderation operations, abuse event visibility, discovery review, webhook abuse protections, report workflows, and safety escalation.
- Exit gate: permission-enforced queues, redacted evidence, auditability, and incident ownership.

### 4. Compliance and legal

Priority: P1.

- Terms acceptance/versioning, export/deletion production workflows, retention, legal review pack, data residency, and certification readiness.
- Exit gate: approved policy ownership and no renderer-driven destructive operation.

### 5. Platform ecosystem

Priority: P2 and feature-flagged.

- Bot API, production webhooks, developer portal, public API versioning, command permissions, discovery v1, and plugin sandbox research.
- Exit gate: server-only credentials, scoped permissions, rate limits, abuse controls, versioning, and kill switches.

### 6. Enterprise readiness

Priority: P3 after stable release evidence.

- SSO/SAML and SCIM design, organization/workspace model, enterprise audit export, isolation hardening, residency, and support/SLA processes.
- Exit gate: accepted architecture and compliance ownership; no speculative runtime implementation.

## Change control

- P0 blockers take precedence over P1-P3 feature work.
- Documentation-only tasks must not silently enable runtime behavior.
- Provider integrations remain disabled until secrets, consent, privacy, failure recovery, and rollout are reviewed.
- Security-sensitive changes require negative permission tests and staging validation.
- Scope changes must update this plan and receive a new governance checkpoint.

## Current decision

Proceed with Task 77 onward in sequence. Production hardening is the immediate focus. Picom remains an internal/staging beta candidate, not a public production release.
