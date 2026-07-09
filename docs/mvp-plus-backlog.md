# Picom MVP+ Backlog

This backlog is the execution order for the approved Tasks 46-75 pack. It authorizes bounded development only; it does not authorize stable publication.

## Execution order

| Phase | Tasks | Outcome |
| --- | --- | --- |
| Scope | 46 | MVP+ scope, branch strategy, exclusions, and release boundary locked |
| Private communication | 47-49 | DM schema/RLS, desktop UI, realtime, unread, notification foundations |
| Social privacy | 50-51 | Follow/friend consistency, privacy preferences, blocking |
| Daily productivity | 52-55 | Notification center, advanced search, saved messages, drafts |
| Community growth | 56-58 | Events, controlled discovery, invite onboarding |
| Trust and moderation | 59-61 | Reports queue, moderation filters, audit UI/export |
| Platform foundations | 62-65 | Restricted bots/webhooks/slash commands/custom media foundations |
| Community formats | 66-68 | Polls, threads, forum, announcement channels |
| Operations and privacy | 69-73 | Restricted operations UI, privacy-safe telemetry/update/crash/export/deletion foundations |
| Release review | 74-75 | Security hardening and MVP+ final audit |

## Priority rules

- **P0:** private-data leak, credential exposure, data loss, auth bypass, startup failure, message failure, or unsafe native IPC. Stop feature work and isolate the fix.
- **P1:** task acceptance blocker or stable-flow regression. Resolve before the next task.
- **P2:** non-blocking UX/performance issue. Record for the next patch unless trivial and in scope.
- **P3:** excluded/future product expansion. Do not implement through this pack.

## Task completion record

Use each task checkpoint under `docs/task-checkpoints/` as the authoritative evidence record. A task is complete only when its required code/docs, checks, commit, and remaining-risk notes are present.

## Persistent stable-release blockers

The following remain independent of MVP+ source work:

1. Production-like Supabase migration/RLS/Storage/Realtime/Edge verification.
2. Historical private attachment signed-URL refresh after reload.
3. Deployed LiveKit native two-client verification.
4. Native Linux/macOS artifact and stable signing/notarization evidence.
5. Stable Windows signing and clean-host lifecycle smoke.
6. Real backup restore/rollback drill.
7. Legal, privacy, publisher, and support sign-off.

## Intake rule

New requests outside Tasks 46-75 require a separate scope decision. They must not be added to an active task, hidden in a bug fix, or implemented as a production claim through a placeholder.
