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

## Task 415 final decision record

Decision: **NO-GO**.

Real Task 406 evidence closed migration/Auth/basic RLS/private Storage uncertainty but did not close private Realtime Presence or Edge validation. Tasks 407-411 remain blocked for hosted LiveKit and native trusted platform evidence. Task 412 lacks authorized legal approval, Task 413 lacks accountable owners/custody, and Task 414 lacks a successful isolated restore/destructive drill. No stable artifact publication, checksum announcement, rollout, or post-launch monitoring is authorized.

## Task 421 hosted Supabase closure decision

Decision remains **NO-GO**. Task 421 confirms a `PARTIAL / BLOCKED` hosted Supabase result: local gates and earlier Auth/core RLS/private Storage evidence pass, but private Presence and the release-scoped Edge Function are not proven. No artifact publication is authorized.
# Task 430 immutable RC decision (2026-07-11)

## Final decision: NO-GO

The deterministic local quality gates and required GitHub Picom QA run `29129185936` are green. This is necessary but not sufficient for a stable release. The release guard correctly refuses promotion while the following evidence is incomplete:

- Hosted Supabase private Presence authorization, Edge Function deployment, and remaining Storage/lifecycle matrix.
- Hosted LiveKit two-client audio, reconnect, and cleanup evidence.
- Native screen-share certification on supported operating systems.
- Trusted Windows signing and clean-machine installation.
- Native Linux AppImage/DEB installation and screen-share certification.
- macOS signing, notarization, stapling, Gatekeeper, and native screen-share certification.
- Named production owners, secret custodians, rotation owners, and recovery approvers.
- Authorized legal/license review and sign-off.
- Complete isolated backup restore plus integrity and destructive-lifecycle validation.

No immutable stable artifacts, final checksums, final provenance, release publication, rollout, or post-release monitoring were initiated. Required product, engineering, security, operations, and support sign-offs remain unapproved.

## Task 520 final Full MVP completion decision (2026-07-11)

### Decision: NO-GO

All 89 Tasks 431-519 have their exact checkpoint and expected commit subject, but Full MVP acceptance remains **Partial**:

- mandatory renderer performance and generated-license checks currently fail;
- the Task 519 staging matrix has 18 BLOCKED flows and no hosted PASS evidence;

## Task 626 Windows-first V1 final decision

Decision: **NO_GO** on 2026-07-12.

The deterministic local matrix passes and Task 668 includes Voice and Screen Share after protected hosted, packaged-Windows, and security evidence. Production mode remains fail-closed Supabase-only. There is still no approved `1.0.0` source freeze, trusted signed Windows artifact, clean-machine smoke, authorized legal/license approval, production ownership/custody, full Storage/Auth recovery, post-signing checksum, or artifact provenance. `npm run release:go-no-go:guard` correctly blocks publication. No tag, GitHub Release, download page, changelog release entry, rollout, or monitoring result is authorized.
- visual and E2E results are coverage contracts, not executed desktop UI evidence;
- RB-01 through RB-11 remain open;
- disk artifacts are unsigned Windows development/beta outputs, not an immutable stable cross-platform set;
- validation occurred with unrelated user-owned working-tree changes and must be repeated from a clean candidate.

No stable publication, release creation, signing, checksum announcement, rollout or post-launch action is authorized. A future decision requires QB-01/QB-02 plus RB-01 through RB-11 to close with evidence on one immutable candidate.
