# Stable Release Blockers

Status: **Open**  
Stable decision: **No-Go until all mandatory blockers are closed**

## Critical release blockers

| ID | Blocker | Required closure evidence | Owner |
| --- | --- | --- | --- |
| RB-01 | Hosted Supabase role/isolation matrix has not run against an approved staging/production-like project | Anonymous/visitor/member/mod/admin/owner tests pass for private/public communities, channels, messages, attachments, profile activity, Mention Feed, and DMs | Security/backend owner |
| RB-02 | Private Storage and historical attachment signed-URL refresh are not production-proven | Unauthorized reads fail; authorized reload/refresh/download works without public-path leakage | Storage owner |
| RB-03 | Hosted Realtime and Edge Functions are not production-proven | Two-client insert/update/delete/deduplication and Edge token/auth tests pass without service-role exposure | Backend owner |
| RB-04 | CLOSED_BY_SCOPE: LiveKit voice is not a V1 capability | Task 621 hides all Voice entry points; future inclusion requires a new evidence gate | Realtime owner |
| RB-05 | CLOSED_BY_SCOPE: Screen Share is not a V1 capability | Task 621 hides all Screen Share entry points; future inclusion requires a new evidence gate | Desktop owner |
| RB-06 | Windows clean-machine installer evidence is missing | Install, first launch, core flow, reinstall, uninstall, checksum, and unsigned/signed behavior recorded | Release owner |
| RB-07 | Linux native packages are not built/smoked on Linux | AppImage and deb install/launch/core-flow/uninstall pass on supported distributions | Linux release owner |
| RB-08 | macOS artifacts are not built, signed, notarized, and smoked on macOS | DMG/zip, Gatekeeper, microphone/screen-recording permissions, launch/core-flow/uninstall pass | macOS release owner |
| RB-09 | Production environment and secret ownership are not frozen | Named owner, protected stores, approved renderer-safe values, deployed targets, and rotation/rollback path recorded | Operations owner |
| RB-10 | Legal/privacy documents lack final legal sign-off | Terms, Privacy, Guidelines, AUP, support/reporting, deletion/export wording, versions, and in-app links approved | Legal/product owner |
| RB-11 | Backup/restore and destructive data lifecycle are not production-proven | Staging restore drill passes; deletion/export paths have legal/operations approval | Database/privacy owner |

## High-priority non-blockers

- Initial renderer chunk remains above the preferred bundle warning threshold.
- Some native accessibility, multi-monitor, DPI, memory, and cold-start evidence remains manual.
- OAuth providers, 2FA, Steam, and Epic remain disabled or deferred and must not be advertised.
- Production auto-update remains outside stable scope.
- Unsigned local artifacts are suitable only for internal testing.

## Reclassification rule

A blocker may move to non-blocker only with a written risk acceptance, named owner, user-facing limitation, rollback/kill-switch path, and evidence that core privacy/security/data integrity is unaffected. Missing evidence alone is never justification for reclassification.

## Task 396 evidence update

Local Supabase/RLS/API/secret-boundary and build gates passed on 2026-07-10. Hosted staging was not configured or authenticated, so RB-01, RB-02, and RB-03 remain open without reclassification.

## Task 397 evidence update

LiveKit service, device, reconnect, mini-card, discovery, and diagnostics contracts passed locally. No hosted token or two-client media session ran, so RB-04 remains open.

## Task 398 evidence update

Screen-share permission recovery, preview/stop, preload, and IPC validation passed. Packaged remote-view evidence on Windows and native Linux/macOS evidence are absent, so RB-05 remains open.

## Task 399 evidence update

Windows packaging and fail-closed signing controls passed without loading a certificate. No signed artifact or clean-machine matrix exists, so RB-06 remains open.

## Task 400 evidence update

Linux packaging and repository-distribution contracts passed, but no native AppImage/deb was built or launched. RB-07 remains open.

## Task 401 evidence update

macOS notarization/signing workflow controls passed, but no native build, Developer ID signature, notarization, staple, Gatekeeper, or permission matrix ran. RB-08 remains open.

## Task 402 evidence update

Legal-flow engineering contracts passed and diagnostics/audio drafts were completed. No authorized legal/project-license approval exists, so RB-10 remains open.

## Task 403 evidence update

Environment and secret-management contracts passed without exposing values. Critical production systems still have no named owner or approved frozen value, so RB-09 remains open.

## Task 404 evidence update

Backup, PITR, maintenance, and migration recovery safety contracts passed without opening a database. No staging restore or destructive lifecycle drill ran, so RB-11 remains open.

## Task 405 final gate

Final checksum/provenance/RC/deployment/rollback process contracts passed, but there are no signed/notarized/native immutable stable artifacts to hash. RB-01 through RB-11 remain release blockers. Decision: **No-Go**; no publication authorized.

## Task 406 real-evidence update

Hosted Supabase execution was BLOCKED by absent staging project linkage and protected operator credentials. RB-01, RB-02, and RB-03 remain open; no remote evidence was fabricated.

## Task 407 real-evidence update

Hosted LiveKit token and two-client voice execution were BLOCKED by absent staging/provider environment and clients. RB-04 remains open.

## Task 408 real-evidence update

Windows native screen-share certification was BLOCKED by missing trusted RC, clean test target, hosted room, and remote client. RB-05 and RB-06 remain open.

## Task 409 real-evidence update

Linux package, voice, and screen-share certification was BLOCKED by the absence of a native Linux runner and final artifacts. RB-05 and RB-07 remain open.

## Task 410 real-evidence update

macOS signature, notarization, staple, Gatekeeper, permission, and screen-share certification were BLOCKED by absent native runner and credentials. RB-05 and RB-08 remain open.

## Task 411 real-evidence update

Windows trusted signing and clean-machine execution were BLOCKED by absent certificate/signing environment, final artifact, and clean test target. RB-06 remains open.

## Task 406 hosted execution superseding update

A dedicated `eu-west-1` staging project was created and migrations, Auth, the role RLS matrix, and private Storage boundaries produced real PASS evidence. Private Realtime Presence still returned `Unauthorized`, Edge Functions were not deployed, and broader lost-access/DM/profile/signed-URL cases remain incomplete. RB-01, RB-02, and RB-03 stay open with narrower scope; no hosted result is overstated.

## Task 412 authorized legal closure

No authorized reviewer, immutable approved policy versions, jurisdiction decision, or project-license grant was supplied. Engineering drafts and smoke tests are not legal approval. RB-10 remains open and stable distribution remains No-Go.
## Task 413 production ownership and custody

A value-free custody matrix now exists, but every accountable owner/store/rotation/recovery field remains unassigned. Task 406 staging credentials are not production custody. RB-09 remains open.
## Task 414 real backup/restore drill

A real hosted staging export and checksum manifest were produced. Restore failed on managed Auth schema compatibility and the alternative local target was blocked by an unrelated active port. No destructive lifecycle test ran. RB-11 remains open.
## Task 415 final immutable RC decision

Decision: **No-Go**. Real hosted Supabase migration/Auth/basic RLS/private Storage evidence exists, but RB-01 through RB-11 are not all closed. No final signed/notarized/native artifact set was generated or published, and no checksum/provenance claim was fabricated.

## Task 419 hosted private Presence

Client/topic/RLS contracts and local gates passed on 2026-07-11, but the protected staging matrix could not run without Supabase CLI linkage and `PICOM_REALTIME_*` credentials. The earlier authenticated private Presence `Unauthorized` result remains unresolved. RB-03 stays open; status is **BLOCKED**, not PASS.

## Task 420 hosted Edge Functions

The release-scoped `livekit-token` source and local JWT/CORS/method/secret contracts passed, but no protected staging deployment or request matrix ran. Placeholder functions were excluded from production claims. RB-03 and RB-04 remain open; status is **BLOCKED**.

## Task 421 hosted Supabase final closure

Local Supabase/RLS/API/secret/build/QA gates passed. Earlier real migration/Auth/core RLS/private Storage results remain valid, but private Presence, deployed Edge Functions, broader lost-access, and historical Storage lifecycle evidence remain incomplete. Hosted status is **PARTIAL / BLOCKED**; RB-01, RB-02, and RB-03 stay open.

## Task 422 hosted LiveKit two-client

Local voice/device/reconnect/Connected Voice contracts passed, but no deployed token endpoint, provider credentials, account pair, or two isolated media clients were available. No real token/audio/reconnect evidence exists. RB-04 remains **BLOCKED**.

## Task 423 Windows native screen share/package

A clean-source Windows x64 NSIS/unpacked internal beta candidate was generated, hashed, and startup-smoked. It is unsigned and no clean install, interactive picker, remote view, or real media cleanup ran. RB-05 remains **BLOCKED**; RB-06 gains package evidence but remains open.

## Task 424 Linux native package/screen share

Linux packaging and screen-share structural contracts passed, but no native workflow could be dispatched with the available GitHub permissions and no Linux host was available. No AppImage/DEB or portal/media evidence exists. RB-05 and RB-07 remain **BLOCKED**.

## Task 425 macOS notarization/screen share

Protected workflow and local signing/permission contracts passed, but dispatch was denied and no Apple credentials/native runner were available. No signed/notarized/stapled artifact or real macOS media evidence exists. RB-05 and RB-08 remain **BLOCKED**.

## Task 426 trusted Windows/clean machine

Signing and package controls passed, but protected dispatch was denied and no certificate or clean target exists. No signed installer, trusted publisher/timestamp, post-signing hash, or clean-machine matrix was produced. RB-06 remains **BLOCKED**.

## Task 427 authorized legal/license approval

Engineering policy, acceptance, audio, Coolicons, and dependency-license gates passed. No authorized reviewer, project-license grant, immutable policy approval, jurisdiction/effective-date/contact decision, or audio-rights approval exists. RB-10 remains **BLOCKED** and stable distribution remains No-Go.

## Task 428 production owners/secret custody

Secret/env/CI controls pass, and the ownership inventory now explicitly separates support, status, incident, and audio responsibilities. Every real owner/store/rotation/recovery/freeze approval remains unassigned. The ownership-transfer UI contract also fails and is carried into lifecycle review. RB-09 remains **BLOCKED**.

## Task 429 isolated restore/destructive lifecycle

Backup hashes matched and isolated random-port Docker attempts were cleaned safely. Restore progressed beyond the previous Auth collision in a fresh DB but stopped at missing `extensions.gin_trgm_ops`; no complete data load or destructive lifecycle ran. Soft-delete/export/ownership-transfer contracts were remediated and pass. RB-11 remains **BLOCKED**.
# Task 430 open blocker snapshot (2026-07-11)

| ID | Blocker | Current evidence | Closure requirement |
| --- | --- | --- | --- |
| RB-01 | Hosted Supabase final matrix | Core Auth/RLS evidence exists; final hosted matrix remains partial | Execute protected staging RLS matrix with approved accounts |
| RB-02 | Private realtime Presence | Static contract passes; no hosted private-channel run | Execute two authorized clients plus unauthorized subscriber denial |
| RB-03 | Hosted Edge Functions and Storage lifecycle | Local contracts pass; protected deployment/config absent | Deploy release-scoped function and run hosted Storage lifecycle checks |
| RB-04 | CLOSED_BY_EVIDENCE: Hosted LiveKit | Protected four-client Voice/Screen run 29197503222 and security run 29199409039 passed | Task 668 inclusion |
| RB-05 | CLOSED_BY_EVIDENCE: Native screen share | Packaged Windows run 29198913461 passed picker, publish, remote render, reconnect, and cleanup | Task 668 inclusion |
| RB-06 | Trusted Windows release | Task 622 found no signing environment, certificate, signed artifact, or workflow run; package version is still 0.1.1-beta.1 | Freeze 1.0.0 commit, sign/timestamp, hash, then validate on clean Windows 10/11 |
| RB-07 | Linux native release | Local contracts pass; no native artifact evidence | Build/install AppImage and DEB on Linux and certify runtime behavior |
| RB-08 | macOS native release | Local contracts pass; no signed/notarized artifact | Sign, notarize, staple, Gatekeeper-check, install, and certify |
| RB-09 | Production ownership/freeze | Roles and custodians remain unassigned | Record named accountable owners and approved freeze evidence |
| RB-10 | Authorized legal approval | Documents remain engineering drafts | Obtain authorized jurisdiction-specific approval and sign-off |
| RB-11 | Isolated restore drill | Backup hashes verified; restore blocked by Supabase image/schema mismatch | Restore compatible backup fully, validate integrity, then run guarded lifecycle checks |

All blockers remain release-blocking. None may be converted to PASS by a local contract, missing-secret skip, placeholder owner, or unsigned artifact.

## Task 520 final Full MVP audit update

Tasks 431-519 have 89/89 exact checkpoints and 89/89 exact commit subjects, but traceability is not release certification. The protected Task 519 matrix remains 0 PASS, 0 FAIL, 18 BLOCKED, so RB-01 through RB-11 remain open.

Two additional local quality gates currently prevent even an immutable Full MVP release-candidate claim:

| ID | Local blocker | Current evidence | Closure |
| --- | --- | --- | --- |
| QB-01 | Renderer performance hard caps fail | `initialJs=1757.0 KiB` over 1650.0; `initialCss=240.8 KiB` over 240.0 | Optimize entry/static JS and initial CSS without raising/disabling approved caps |
| QB-02 | Third-party license report is stale | `licenses:smoke` passes; `licenses:check` fails | Finalize concurrent package/assets, regenerate, review and pass the check |

Task 520 decision: **Full MVP Partial; Stable No-Go**. No artifact publication is authorized.

## Task 577 final hosted meeting backend update

The 18-gate owner/admin/moderator/member/visitor/guest/blocked staging matrix and fail-closed protected runner are now defined. Local migration, secret-boundary, and deterministic meeting contracts pass, but the protected staging role fixtures, committed-to-staging migration checksum comparison, deployed meeting token/webhook, private Realtime, two-client reconciliation, hosted audit records, and temporary fixture-access revocation evidence are unavailable. Captions are provider-disabled and only the endpoint execution is `NOT_APPLICABLE`; transcript/privacy isolation remains mandatory. RB-01, RB-02, RB-03, and RB-04 remain **BLOCKED** and the stable decision remains **No-Go**.

## Task 578 Windows native meeting update

The Windows x64 exact-artifact certification matrix now requires a trusted timestamped signature, controlled Windows 10/11 machine inventory, 22 packaged meeting flows, and a distinct remote client. No signed final candidate, clean/controlled test target, hosted room, native device run, interactive picker, or remote screen/window render was available during Task 578. Local Electron/meeting/screen-share contracts pass, but they are not native certification. RB-04, RB-05, and RB-06 remain **BLOCKED** and no Windows production support claim is authorized.

## Task 579 Linux native meeting update

The native Linux x64 AppImage/DEB matrix now requires real hashes, package metadata, Wayland and X11 sessions, PipeWire/portal/audio/device inventory, 23 packaged flows, and a distinct remote client. Task 579 ran on Windows; no Linux-produced artifact, desktop session, portal picker, native device, or remote rendered share was available, and Windows cross-build output was explicitly rejected as evidence. RB-04, RB-05, and RB-07 remain **BLOCKED**. RPM, ARM64, Flatpak, and Snap are not claimed.

## Task 580 macOS native meeting update

The native macOS x64 matrix now requires post-staple DMG/ZIP hashes, Developer ID and nested signatures, hardened runtime/entitlements, accepted notarization, app/DMG staple, quarantined Gatekeeper launch, 27 packaged meeting/permission flows, and a distinct remote client. Task 580 ran on Windows without Apple signing/notary material, a macOS runner, final artifacts, TCC permission access, or remote rendered share. RB-04, RB-05, and RB-08 remain **BLOCKED**. Apple Silicon/universal support is not claimed without separate evidence.

## Task 581 meeting security/privacy/RLS gate

Fifteen deterministic migration/RLS/token/webhook/privacy/abuse/captions/observability/Electron IPC/secret/redaction controls pass, and no local critical finding is recorded. The final matrix now classifies eight identities across nine private meeting resources and defines five explicit remediation items. However, deployed unauthorized-access, private Realtime, final Edge/LiveKit, and native consent/media-indicator evidence remains blocked. Stable security status is **NO-GO**; RB-01 through RB-05 and applicable native package blockers remain open. Any future data/media or secret leak is release-blocking.

## Task 582 meeting workspace production-readiness audit

Tasks 528-581 have 54/54 checkpoints and 54/54 exact task commit subjects. Meeting implementation and deterministic local contracts are complete, including 44/44 meeting contract checks and 15/15 local security controls. Hosted two-client/backend/capacity evidence and Windows/Linux/macOS native certification remain **BLOCKED**, so RB-01 through RB-11 stay open and stable remains **NO-GO**.

Task 520 local-quality superseding status:

| ID | Status | Task 582 evidence |
| --- | --- | --- |
| QB-01 | **CLOSED at hard-cap level** | Initial JS 1191.8 KiB passes its 1200 KiB target; initial CSS 235.1 KiB and total assets 3404.0 KiB pass hard caps but remain target-level warnings. |
| QB-02 | **CLOSED** | `licenses:smoke` and `licenses:check` both pass at audit base `baceeec`. |
| QB-03 | **OPEN** | `RegisterScreen` imports `assets/brand/picom-logo.png`, but that user-owned asset is not tracked in HEAD. A clean-clone build is not reproducible until the approved asset is committed or the import is corrected. |

No signed/native/final artifact, checksum, provenance, deployment, or publication was produced by Task 582.


## Task 619 - V1 hosted Supabase closure update

Status: **BLOCKED** (2026-07-12).

- RB-01 remains open: the protected GitHub environment and complete synthetic actor/fixture inventory are not configured, so no immutable hosted matrix run exists.
- RB-02 remains open: local policy and client contracts pass structurally, but the prior private Presence Unauthorized result needs a fresh two-client staging run after migration parity is verified.
- RB-03 remains open: the V1 Edge release manifest is narrowed to client-config, validate-file, and user-data-export, but those exact deployed functions have not completed the protected hosted boundary run.
- Dashboard access confirms a dedicated picom-staging project exists; this is environment discovery only, not release certification.
- Meeting, Radio, Podcast, LiveKit-provider, account-finalization, placeholder and post-V1 functions no longer block this V1 hosted workflow.

Closure procedure and secret-safe fixture contract: [V1 hosted Supabase closure](v1-hosted-supabase-closure.md).


## Task 621 V1 Voice and Screen Share decision

Decision: **INCLUDED** (2026-07-12). RB-04 and RB-05 are closed by real hosted, packaged-Windows, security, reconnect, and cleanup evidence. Voice channels, Settings, Connected Voice, Community Admin controls, Help, authenticated routes, Edge deployment, and release copy are V1-scoped. This does not close trusted signing, clean-machine, legal, production ownership/capacity, immutable-RC, or final Go/No-Go blockers.


## Task 622 trusted Windows V1 candidate

Status: **BLOCKED** (2026-07-12). Local audit found no signtool, code-signing certificate, signing variables, protected GitHub environment, signed workflow run, signed artifact, post-signing SHA-256, or clean Windows target. Package metadata remains 0.1.1-beta.1 while V1 requires 1.0.0. The protected workflow now fails closed on full-SHA/version/channel mismatch, but RB-06 remains open until trusted signing and the exact clean-machine matrix pass.

## Task 623 final legal approval and production ownership

Status: **BLOCKED / NO-GO** (2026-07-12). The exact V1 policy bundle, project license, jurisdictions, effective dates, operator/contact identity, and deletion/export wording have no authorized approval. Every V1 production system, recovery duty, and secret-custody role remains `UNASSIGNED`; renderer-safe identifiers and secret values are intentionally not frozen. Voice and Screen Share are included technically, so their transport/no-recording disclosure is present in the legal-review draft, but it is not approved legal text. RB-09 and RB-10 remain open.

## Task 624 isolated backup restore and destructive lifecycle

Status: **PARTIAL / BLOCKED** (2026-07-12). The immutable synthetic staging database now restores fully into an isolated compatible Supabase Postgres target; row-count, orphan, RLS/private-access and rollback-scoped destructive lifecycle checks pass. Storage object bytes were not backed up/restored and no isolated GoTrue API proved revoked token rejection, so full recovery is not certified and RB-11 remains open.

## Task 625 Picom v1.0.0 release candidate build

Status: **BLOCKED / NO ARTIFACT** (2026-07-12). The complete local deterministic quality matrix passes after updating the hosted-validation workflow to the official Node 24 action runtimes. RC prerequisites do not pass: package metadata is `0.1.1-beta.1`, hosted Supabase gates are open, trusted Windows signing/clean-machine evidence is absent, legal/ownership gates are open, and full Storage/Auth recovery remains blocked. No final package, signature, checksum or provenance was generated; Task 626 is blocked.

## Task 626 final V1 Go/No-Go and public release

Decision: **NO_GO** (2026-07-12). The complete local quality matrix passes, but automatic No-Go conditions remain: no trusted Windows artifact, no authorized legal approval, no production owner/custody, no complete hosted Supabase evidence, no full Storage/Auth recovery and no immutable RC/checksum/provenance. The release guard correctly exits nonzero. No `v1.0.0` remote tag or GitHub Release exists, and no public download/website/changelog update was made.
