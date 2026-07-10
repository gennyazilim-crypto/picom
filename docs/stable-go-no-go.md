# Picom Stable Go / No-Go Decision

Decision date: 2026-07-10  
Decision: **No-Go**

## Decision basis

The local application, deterministic QA, Electron security configuration, Windows candidate generation, release documentation, checksum/provenance contracts, and rollback procedures are in good condition. Public stable distribution is still unsafe because mandatory external/platform/legal gates are open.

## Blocking gates

- Hosted Supabase RLS/Storage/Realtime/Edge and Auth flow evidence.
- Private attachment and DM non-participant denial evidence.
- Real two-client LiveKit voice and cross-platform screen-share certification.
- Clean-machine Windows install/core-flow/uninstall evidence.
- Native Linux AppImage/deb build and smoke.
- Signed/notarized macOS DMG/zip build and smoke.
- Approved production values/owners and final stable version/channel.
- Final legal/policy review and exact in-app document/version verification.
- Backup restore and destructive data lifecycle rehearsal.

## Known non-blockers

- Initial renderer bundle warning and ineffective voice dynamic-import warning.
- Additional physical DPI/multi-monitor/accessibility/performance evidence beyond minimum release certification.
- Deferred OAuth/2FA/provider features that remain disabled and unadvertised.
- Production auto-update remains outside scope.

## Sign-offs

| Area | Owner | Decision | Date |
| --- | --- | --- | --- |
| Product | TBD | Not signed | TBD |
| Engineering | TBD | Local gates passed; stable No-Go | TBD |
| Security | TBD | Hosted gate pending | TBD |
| Operations/release | TBD | Cross-platform artifacts pending | TBD |
| Legal/privacy | TBD | Final review pending | TBD |
| Support | TBD | Distribution/support channel pending | TBD |

## Required next action

Do not distribute stable artifacts. Close `docs/release-blockers.md` with archived evidence, generate a final stable-version artifact set, rerun Task 360 and Task 361, obtain named sign-offs, then update this document with a new decision record. A previous No-Go must never be silently edited into Go without evidence.

## Task 405 final review

Decision remains **No-Go**. Tasks 396-404 improved and archived deterministic local evidence, but did not produce hosted Supabase/LiveKit proof, native platform certification, legal approval, named production ownership, or a real restore drill. Consequently no final immutable artifact set, post-signing checksums, or release provenance exists. Distribution and post-launch monitoring must not start.
