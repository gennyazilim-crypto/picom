# Picom V2 Governance Lock

Status: Locked  
Effective after: Task 150 final post-launch readiness audit  
Platforms: Windows, Linux, macOS Electron desktop only

## Purpose

V2 is a controlled reliability and product-maturity phase, not permission for unrestricted scope expansion. Task 150 concluded that stable public launch is delayed pending blocker closure. V2 work must therefore protect core chat, close production evidence gaps, and add only explicitly approved value with an owner, backend enforcement, tests, rollout and rollback.

## V2 admission rules

A task may enter V2 only when all of the following are true:

- It has one bounded objective, explicit exclusions, acceptance criteria and a named product/engineering owner domain.
- It preserves Picom's Electron desktop direction, current design language, design tokens, Coolicons/AppIcon and light/dark themes.
- Security, privacy, tenant isolation, accessibility, performance, support and operations impact are identified before implementation.
- Backend permissions/RLS enforce sensitive behavior; UI visibility is never the sole security control.
- Secrets and privileged credentials remain outside renderer code, logs, diagnostics and repository files.
- Feature availability is disabled by default when risk or backend readiness is incomplete.
- A relevant test/smoke/build plan, staging evidence requirement, rollout/kill-switch and rollback path exist.
- It does not consume capacity needed to close a stable-release blocker unless explicitly approved by go/no-go owners.

## Allowed in V2

### Priority 0: stable blocker closure

- Diagnostics and abuse-event redaction gate repair and manual safe-export review.
- Clean Supabase migration, generated types, pgTAP/RLS and cross-tenant adversarial staging evidence.
- Production attachment scanner, quarantine worker, signed delivery and restore/orphan handling.
- Real realtime and LiveKit multi-client/platform/degraded-network certification.
- Signed/notarized Windows/Linux/macOS artifacts, clean-machine install/upgrade/uninstall and rollback certification.
- Privacy-reviewed monitoring, stable SLO dashboards/alerts and named incident/support ownership.
- Real backup restore, disaster-recovery, rollback and incident tabletop exercises.
- Final legal/license/privacy/vendor/support/operations sign-offs.

### Priority 1: reliability and safety maturity

- Measured startup, crash, memory, bundle, large-list, media and reconnect improvements.
- Trust and safety workflows with backend authorization, restricted evidence, audit, appeals and staffed response.
- Accessibility, localization, keyboard, DPI and platform-native certification fixes.
- Compatibility, deprecation, feature-flag, remote-config and safe-rollout hardening.
- Privacy-safe support/feedback loops and transparent user controls.

### Priority 2: explicitly approved desktop value

- Small improvements to established community, channel, messaging, profile, Mention Feed, voice, screen share, settings and attachment flows.
- Approved community features that reuse existing permission, storage, realtime and moderation boundaries.
- Private/development-only bot, webhook or developer foundations when disabled by default and not represented as public production services.

Priority 2 work cannot start when it would delay an unresolved P0 blocker without an explicit scope decision.

## Post-V2 backlog

These areas may be researched or documented but are not V2 delivery commitments:

- Public bot/webhook/developer marketplace and third-party publishing.
- Executable desktop plugin ecosystem.
- Enterprise SSO/SCIM/admin/compliance product commitments.
- Billing, paid plans, marketplace payouts and monetization.
- Public community discovery marketplace expansion.
- Production E2EE.
- Advanced behavioral analytics or experimentation.
- Multi-region/data-residency implementation.
- Mobile clients or a web-first responsive redesign.

Moving an item from post-V2 requires product approval, architecture/security/privacy review, capacity tradeoff, updated roadmap and a new task/ADR where appropriate.

## Forbidden until separately approved

- Mobile UI, mobile application work or conversion of the desktop layout into mobile/web-first navigation.
- Discord branding, logo, copied assets or exact Discord colors.
- Arbitrary plugin code execution, dynamic remote code loading, `eval`, unrestricted Node/Electron/preload/IPC access, shell commands or general file-system access.
- Public API keys, bot tokens, webhook secrets, Supabase service-role keys, LiveKit secrets, signing keys or updater credentials in renderer/local settings/logs/diagnostics.
- Security-sensitive behavior enforced only by React/UI checks.
- Public launch claims based only on placeholder documents or structural smoke tests.
- External analytics/crash/support upload without approved privacy, redaction, consent/control, retention and backend validation.
- Destructive retention/deletion/migration jobs enabled by default without backup, dry run, approval and rollback/restore evidence.
- Public marketplace, billing, enterprise or E2EE promises before their prerequisites and owners exist.

## Execution discipline

Every implementation proceeds as a single task:

1. Read the active task and relevant current files once.
2. Confirm exact files and boundaries before editing.
3. Apply one focused change without unrelated refactoring or redesign.
4. Run task-relevant tests; run typecheck/mock smoke and build when code changes or the task requires them.
5. Record limitations honestly, including unavailable CLI, provider, platform or staging evidence.
6. Create/update the named task checkpoint.
7. Commit only task files; exclude temporary logs/build scratch data.
8. Push the completed commit before starting the next task.
9. Stop promotion, not documentation, when a release/security gate fails; never relabel a failure as a pass.

## Change control

Scope changes require a written decision containing:

- requested capability and user value;
- why it belongs in V2 now;
- displaced work and blocker impact;
- data/security/privacy/abuse/accessibility implications;
- backend and desktop architecture decision;
- rollout, kill switch, rollback and support ownership;
- updated acceptance and release gates.

Urgent security fixes may bypass normal scheduling but not evidence, least privilege, audit, incident handling or post-incident review.

## Definition of done

A V2 task is done only when implementation/documentation matches its scope, relevant checks pass or failures are explicitly recorded, checkpoint and commit exist, push completes, no unrelated product files are staged, and remaining production evidence is not overstated.

The V2 phase is not production-ready until the final readiness audit is rerun and formal go/no-go owners approve promotion.
