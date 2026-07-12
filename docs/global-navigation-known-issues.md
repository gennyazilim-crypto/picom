# Global Navigation Known Issues

Date: 2026-07-12

## Release evidence blockers

| Priority | Status | Issue | Required closure |
| --- | --- | --- | --- |
| P0 release evidence | BLOCKED | Protected hosted Supabase two-client presence, unread badge, reconnect, and access-loss propagation were not executed locally. | Run the protected hosted-validation workflow with two isolated test identities and retain redacted evidence. |
| P0 release evidence | BLOCKED | Real pgTAP RLS execution was skipped because Supabase CLI is unavailable. | Install the approved Supabase CLI and run `npm run supabase:rls:test` against an isolated local/staging database. |
| P0 release evidence | BLOCKED | Pixel visual regression and Electron UI E2E runners are contract-only; no tuned cross-platform baseline execution is claimed. | Activate the approved Playwright/Electron runner and capture Windows, Linux, and macOS evidence. |

## Engineering risks

| Priority | Status | Issue | Mitigation |
| --- | --- | --- | --- |
| P1 | OPEN | Initial CSS is 239.9 KiB against a 240 KiB hard cap. | Consolidate legacy global styles before adding more startup CSS; keep feature CSS lazy. |
| P1 | OPEN | Initial JS and total assets exceed warning targets, although hard caps pass. | Continue splitting optional voice/admin surfaces and prevent new eager imports. |
| P1 | OPEN | Radio badge intentionally reports only visible realtime occupancy. It will not display mock occupancy or infer live state from the number of Radio communities. | Provide the protected hosted Radio occupancy source before claiming cross-client live badges. |
| P2 | MANUAL | Physical 100/125/150% DPI, multi-monitor, Windows Narrator, macOS VoiceOver, and Linux Orca checks were not executed by this shell audit. | Complete the release desktop accessibility matrix on native machines. |
| P2 | OPEN | Help & Support can export/copy redacted diagnostics, but automated report submission remains unconfigured. | Keep the UI truthful until an approved support backend and retention policy exist. |

## Closed during this audit

- Friend-presence resubscribe could briefly create overlapping realtime channels while auth/RPC setup was pending. The service now keeps one active subscription, cancels superseded setup, guards post-await work, and delays transient offline fallback.
- Global badge constants were removed in Task 615 and notification routes now revalidate authorization before marking an item read.

These known issues do not invalidate the local Full MVP navigation PASS, but the P0 evidence blockers must close before stable production release approval.
