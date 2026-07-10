# Picom v3 roadmap governance lock

## Status and authority

This document locks Picom v3 planning after the Task 250 final v2 readiness audit. It authorizes planning and evidence-driven hardening, not uncontrolled feature expansion or a stable-release claim. The current stable v2 No-Go blockers remain the first priority.

Picom remains an Electron desktop application for Windows, Linux, and macOS. Mobile UI, a mobile app, and web-first responsive product direction are excluded.

## V3 goals

1. Close live staging, RLS, backup/restore, package, signing, accessibility, security, legal, monitoring and rollback evidence gaps from v2.
2. Move approved mock/foundation flows to authenticated Supabase/LiveKit production paths without weakening permissions or privacy.
3. Improve desktop reliability, accessibility, localization, startup/memory/bundle performance and support diagnostics.
4. Keep post-MVP surfaces behind explicit scope, feature, permission and backend enforcement gates.
5. Produce auditable release evidence and a new dated Go/No-Go decision rather than retroactively changing prior records.

## Excluded work

- Mobile application, mobile navigation or web-first redesign.
- Discord branding, logos, assets or exact colors.
- Public plugin runtime/marketplace, arbitrary code loading, shell or unrestricted filesystem access.
- Unapproved billing, enterprise console, SSO/SCIM, multi-region/self-host migration or public developer platform.
- Production E2EE, analytics/crash provider, auto-update, destructive retention or account-finalization schedule without their separate approvals.
- Provider credentials, production data or release secrets in source, docs, fixtures, logs or diagnostics.
- Scope additions that are not represented by an approved numbered task.

## Approval rules

- Product and Engineering approve user-visible scope and success criteria.
- Security approves authorization/RLS, native/IPC, uploads, external links, secrets and executable extension changes.
- Legal/Privacy approves policy, age/eligibility, analytics, export/deletion/retention, provider and regional changes.
- Operations approves migrations, jobs, monitoring, backup/restore, rollout and rollback changes.
- Release Engineering approves packaging, signing, notarization, artifact and update changes.
- Any Critical/High finding, cross-tenant leak, credential exposure, data-loss risk or unreviewed destructive path blocks merge/release until fixed and retested.

Frontend visibility is never the only security control. Supabase RLS/RPC/Edge Function or trusted backend enforcement remains authoritative.

## Execution discipline

Use exactly one numbered task at a time:

1. Read the task and directly relevant current files once.
2. Make the smallest scoped change; do not refactor unrelated code.
3. Run the task-specific smoke plus typecheck/mock/build when runtime code changes.
4. Create the exact task checkpoint with changed files, commands, results and remaining limitations.
5. Commit with the task-specific message and push before opening the next task.
6. If a required check fails, fix that task before continuing; never mark failure as passing.

Documentation, structural smoke, simulation and placeholder state must be labeled honestly. They do not substitute for live staging, clean-host, provider, external audit or legal evidence.

## Stop conditions

Pause the sequence and preserve evidence when:

- a migration, typecheck, build, core smoke or security boundary fails;
- an unexpected user change/worktree conflict appears;
- implementation would require production credentials/data or destructive production action;
- requirements conflict with desktop-only scope, signed legal/security decisions or the v2 blocker record;
- a task would expose private data, bypass RLS, load arbitrary code or weaken Electron isolation;
- the safe implementation needs a non-obvious product/legal/security decision not contained in the task.

External environment blockers are documented without fake success. Safe planning/contract work may continue only when the task explicitly allows it.

## Change control

New v3 tasks require an owner, priority, dependencies, security/privacy impact, acceptance criteria, test path and release classification. Replacements must identify superseded task/document/behavior without deleting historical checkpoints. Emergency security work may interrupt ordering, but requires incident linkage, narrow scope and follow-up evidence.

## Exit criteria

The governance lock may be superseded only by a dated approved decision that references closed v2 blockers, completed v3 audit evidence, remaining risks, rollout/rollback readiness and named Product, Engineering, Security, Operations, Legal/Privacy, Support and Release sign-offs.
