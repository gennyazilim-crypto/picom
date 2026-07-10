# Prioritized Post-Launch Backlog

This backlog starts only after a stable Go decision. It does not authorize release-scope expansion.

## P0 after launch

1. Triage crash, startup, login, message, upload, voice, screen-share, installer, and security reports.
2. Execute only release-critical hotfixes with tests and rollback notes.
3. Compare first-24-hour SLO signals with release thresholds.

## P1 operational hardening

1. Reduce the initial renderer bundle and isolate optional diagnostics/admin/voice modules.
2. Capture packaged startup and long-running memory baselines on Windows/Linux/macOS.
3. Expand automated platform install/uninstall smoke coverage.
4. Automate hosted synthetic RLS/Realtime/Storage regression runs.
5. Complete periodic backup restore drills and alert validation.

## P2 product quality

1. Improve accessibility evidence with keyboard, screen reader, high-contrast, reduced-motion, DPI, and multi-monitor sessions.
2. Improve localization coverage and long-label visual regression fixtures.
3. Refine support diagnostics and known-issue routing from real launch feedback.

## v4 backlog

- Evaluate production auto-update only after signed rollout/rollback infrastructure exists.
- Reassess 2FA and approved social login providers after auth operations are mature.
- Reassess public discovery, bots/webhooks, plugin/runtime, enterprise controls, and advanced analytics under separate security/product decisions.

## Rejected / not now

- Mobile UI or mobile application.
- Claiming production E2EE without a separately reviewed protocol.
- Self-service verification approval or frontend-only security enforcement.
- Shipping placeholders as completed security, legal, or operational controls.
- Broad permission/schema migrations without hosted RLS evidence.
