# Picom feature prioritization matrix

Status: v3 planning baseline  
Reviewed: 2026-07-10  
Scope: remaining tasks 256-350 for the Windows, Linux and macOS Electron product

## Scoring model

Each feature is scored from 1 (low) to 5 (high):

- **Value (V):** direct user or operator value.
- **Delivery risk (R):** probability/impact of implementation or rollout failure.
- **Complexity (C):** engineering, QA and operational effort.
- **Revenue impact (Rev):** plausible contribution to adoption, retention or future revenue; this is not a forecast.
- **Security risk (Sec):** harm if implemented incorrectly or left materially incomplete. A high score requires a security gate, not a rushed implementation.

Priority is a product decision informed by the scores, dependencies and current v2 No-Go evidence. It is not a mathematical ranking.

- **P0:** production/release blocker or safety-critical completion of an existing user flow.
- **P1:** high-value work required for a dependable v3 product.
- **P2:** useful after P0/P1 evidence is complete.
- **P3:** experiment, strategic reassessment, provider proof of concept or explicitly deferred direction.

## Global dependency keys

- **BASE:** stable desktop shell, current MVP behavior, typecheck/build/mock smoke.
- **HOSTED:** hosted Supabase staging project and CLI/manual SQL access.
- **RLS:** hosted RLS policy validation with role fixtures.
- **OBS:** redacted logs, metrics, request IDs and operational alerts.
- **LEGAL:** approved terms, privacy policy, age/eligibility and retention language.
- **VOICE:** stable LiveKit token service, device permissions and two-client QA.
- **RELEASE:** signed/packaged artifacts, rollback evidence and distribution process.
- **IDENTITY:** production email/auth provider configuration and session policy.

## Growth and community governance (256-263)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 256 | Growth onboarding experiments plan | 3 | 2 | 2 | 3 | 2 | P2 | BASE, consent-safe measurement plan |
| 257 | Referral and invite growth system plan | 4 | 3 | 3 | 4 | 4 | P2 | 279, abuse/rate-limit controls, LEGAL |
| 258 | Community quality ranking plan | 3 | 5 | 4 | 4 | 5 | P3 | moderation evidence, privacy review, appeal path |
| 259 | Creator/community-owner toolkit plan | 4 | 2 | 3 | 4 | 2 | P2 | 282-285, owner research |
| 260 | Moderator workflow v3 plan | 5 | 2 | 2 | 2 | 4 | P1 | 284-285, 289-290 |
| 261 | Advanced permission model review | 5 | 4 | 4 | 2 | 5 | P0 | BASE, RLS, role matrix |
| 262 | Channel permission overrides plan | 4 | 5 | 5 | 2 | 5 | P2 | 261, RLS; defer implementation until model is proven |
| 263 | Public read-only community hardening | 5 | 4 | 4 | 3 | 5 | P0 | HOSTED, RLS, attachment access tests |

## Feed, profile and messaging production integration (264-278)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 264 | Mention Feed Supabase production integration | 5 | 4 | 5 | 4 | 4 | P1 | HOSTED, RLS, 269, pagination/read state |
| 265 | Stories header Supabase integration | 3 | 3 | 3 | 3 | 3 | P2 | 267, HOSTED, RLS |
| 266 | Profile activity Supabase integration | 4 | 4 | 4 | 3 | 5 | P1 | HOSTED, RLS, 268 privacy model |
| 267 | Profile follow/unfollow persistence | 4 | 3 | 3 | 4 | 3 | P1 | HOSTED, RLS, idempotency |
| 268 | Profile privacy settings implementation | 5 | 4 | 4 | 2 | 5 | P0 | HOSTED, RLS, LEGAL |
| 269 | Message mention extraction pipeline | 5 | 4 | 4 | 3 | 4 | P1 | message persistence, transaction/idempotency model |
| 270 | Reply system production persistence | 5 | 4 | 4 | 3 | 4 | P1 | message schema, RLS, deletion policy |
| 271 | Emoji picker production polish | 3 | 1 | 2 | 2 | 1 | P2 | BASE, accessibility/localization |
| 272 | Reaction analytics-safe summaries | 3 | 3 | 3 | 2 | 4 | P2 | reactions persistence, privacy review; no invasive analytics |
| 273 | Comment preview production model | 3 | 4 | 4 | 3 | 5 | P2 | RLS, 264, visibility filtering |
| 274 | Message editing conflict handling | 5 | 4 | 4 | 2 | 3 | P1 | version metadata, realtime ordering |
| 275 | Realtime event deduplication hardening | 5 | 4 | 4 | 2 | 4 | P0 | event IDs, idempotency, reconnect tests |
| 276 | Unread/read state production integration | 5 | 4 | 4 | 3 | 3 | P1 | HOSTED, RLS, multi-client sync |
| 277 | Notification inbox production integration | 4 | 4 | 4 | 3 | 4 | P1 | 276, RLS, notification preference model |
| 278 | Quiet hours and DND enforcement | 4 | 2 | 3 | 2 | 2 | P1 | 277, timezone service, native notification abstraction |

## Community operations and safety UX (279-293)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 279 | Community invite acceptance production | 5 | 4 | 4 | 4 | 5 | P0 | HOSTED, RLS, rate limits, idempotency |
| 280 | Join public community production flow | 5 | 4 | 4 | 4 | 5 | P0 | 263, 279, RLS, abuse controls |
| 281 | Community role assignment UI | 4 | 4 | 3 | 2 | 5 | P1 | 261, RLS, role hierarchy tests |
| 282 | Community settings persistence | 4 | 3 | 3 | 3 | 4 | P1 | HOSTED, RLS, audit log |
| 283 | Channel create/edit/delete polish | 4 | 3 | 3 | 2 | 4 | P1 | RLS, active-channel fallback, audit log |
| 284 | Member management MVP polish | 5 | 4 | 4 | 2 | 5 | P1 | 261, RLS, moderation audit events |
| 285 | Community audit log viewer | 4 | 4 | 4 | 2 | 5 | P1 | append-only audit model, RLS, redaction |
| 286 | Legal acceptance tracking | 5 | 4 | 3 | 2 | 5 | P0 | LEGAL, versioned policy records |
| 287 | Policy versioning | 5 | 3 | 3 | 2 | 5 | P0 | LEGAL, 286, immutable acceptance history |
| 288 | Age and eligibility gate plan | 4 | 4 | 3 | 2 | 5 | P1 | LEGAL, regional review; planning only until approved |
| 289 | Content reporting UX polish | 5 | 3 | 3 | 2 | 5 | P1 | moderation queue, abuse event taxonomy, RLS |
| 290 | Block and mute UX polish | 5 | 3 | 3 | 2 | 5 | P1 | relationship model, RLS filtering, realtime sync |
| 291 | Search/command palette production | 4 | 3 | 4 | 2 | 4 | P2 | permission-filtered search API, keyboard service |
| 292 | Keyboard shortcut finalization | 3 | 2 | 2 | 1 | 2 | P2 | overlay manager, accessibility QA |
| 293 | Settings menu completeness review | 4 | 2 | 2 | 2 | 3 | P1 | all production setting owners and persistence paths |

## Voice and screen share (294-300)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 294 | Voice device selection production | 5 | 4 | 4 | 3 | 3 | P1 | VOICE, OS permission/device QA |
| 295 | Voice reconnect and recovery | 5 | 5 | 5 | 3 | 4 | P0 | VOICE, OBS, sleep/wake and network-state handling |
| 296 | Screen-share permission recovery | 5 | 4 | 4 | 3 | 5 | P0 | VOICE, safe IPC, OS permission QA |
| 297 | Voice mini-card production integration | 4 | 3 | 3 | 2 | 3 | P1 | 295, shared voice state |
| 298 | Active voice rooms discovery | 3 | 4 | 4 | 3 | 4 | P2 | VOICE, RLS/presence visibility policy |
| 299 | Screen-share preview and stop controls | 5 | 4 | 4 | 3 | 5 | P1 | 296, safe source selection and track cleanup |
| 300 | LiveKit production capacity notes | 4 | 3 | 2 | 2 | 4 | P1 | VOICE, expected concurrency, vendor limits |

## Packaging, diagnostics and desktop security (301-312)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 301 | Windows packaging QA extended | 5 | 4 | 4 | 4 | 4 | P0 | RELEASE, clean Windows VM |
| 302 | Linux packaging QA extended | 5 | 4 | 4 | 3 | 4 | P0 | RELEASE, supported distro matrix |
| 303 | macOS packaging QA extended | 5 | 5 | 5 | 3 | 5 | P0 | RELEASE, Apple signing/notarization access |
| 304 | Release artifact naming/versioning | 4 | 2 | 2 | 2 | 3 | P0 | semantic version policy, release channels |
| 305 | Release checksums/provenance | 5 | 3 | 3 | 2 | 5 | P0 | 304, CI trusted build context |
| 306 | Beta distribution portal process | 4 | 3 | 3 | 3 | 4 | P1 | RELEASE, access control, privacy notices |
| 307 | Support diagnostics UX final | 4 | 3 | 3 | 2 | 5 | P1 | redaction contract, consent and export limits |
| 308 | Logs redaction regression test | 5 | 3 | 3 | 1 | 5 | P0 | logging service, representative secret fixtures |
| 309 | Security headers/CSP production | 5 | 4 | 4 | 1 | 5 | P0 | attachment/CDN domains, packaged renderer QA |
| 310 | Electron preload API contract freeze | 5 | 4 | 3 | 1 | 5 | P0 | IPC inventory, versioned renderer contract |
| 311 | IPC fuzz/invalid-payload checks | 5 | 4 | 4 | 1 | 5 | P0 | 310, validators, isolated test harness |
| 312 | Safe external-links production test | 5 | 3 | 3 | 1 | 5 | P0 | centralized externalLinkService, IPC allowlist |

## Supabase and backend production evidence (313-325)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 313 | Supabase environment validation final | 5 | 3 | 3 | 2 | 5 | P0 | HOSTED, secret separation, environment schema |
| 314 | Supabase CLI setup docs/fallback | 4 | 2 | 2 | 1 | 3 | P0 | approved CLI installation or documented manual path |
| 315 | Hosted staging RLS validation | 5 | 5 | 5 | 2 | 5 | P0 | HOSTED, RLS, role fixtures and evidence capture |
| 316 | Storage signed-URL/private-access review | 5 | 5 | 4 | 2 | 5 | P0 | HOSTED, RLS, object-path policy |
| 317 | Realtime staging validation | 5 | 4 | 4 | 2 | 4 | P0 | HOSTED, two-client harness, 275 |
| 318 | Edge Functions staging validation | 5 | 4 | 4 | 2 | 5 | P0 | HOSTED, secret manager, auth tests |
| 319 | Supabase backup/PITR review | 5 | 4 | 3 | 1 | 5 | P0 | HOSTED plan capabilities, restore ownership |
| 320 | Database migration rollback drill | 5 | 5 | 5 | 1 | 5 | P0 | backup verification, staging clone, runbook |
| 321 | Production data-seeding policy | 4 | 3 | 2 | 1 | 5 | P0 | environment gates, redacted fixtures |
| 322 | Admin bootstrap production process | 5 | 4 | 3 | 1 | 5 | P0 | audited one-time command, strong credential flow |
| 323 | Rate-limit staging validation | 5 | 4 | 4 | 1 | 5 | P0 | HOSTED, abuse fixtures, safe thresholds |
| 324 | Abuse-event dashboard polish | 4 | 3 | 3 | 1 | 5 | P1 | abuse event source, app-admin RLS, redaction |
| 325 | Community-guidelines acceptance flow | 4 | 3 | 3 | 2 | 4 | P1 | LEGAL, 286-287, community policy versioning |

## Privacy, account security and identity (326-336)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 326 | Deletion/retention user messaging | 5 | 3 | 3 | 1 | 5 | P0 | LEGAL, deletion policy, actual retention behavior |
| 327 | Message export admin policy | 4 | 4 | 3 | 2 | 5 | P1 | LEGAL, private-channel authorization, audit log |
| 328 | Data export real implementation | 5 | 5 | 5 | 2 | 5 | P0 | LEGAL, async job/storage, field allowlist, RLS |
| 329 | Account deletion real implementation | 5 | 5 | 5 | 1 | 5 | P0 | LEGAL, owned-community handling, session revocation |
| 330 | Password reset production | 5 | 4 | 4 | 2 | 5 | P0 | IDENTITY, redirect allowlist, rate limits |
| 331 | Email verification production | 5 | 4 | 4 | 2 | 5 | P0 | IDENTITY, resend limits, safe deep links |
| 332 | Session management production | 5 | 5 | 5 | 2 | 5 | P0 | IDENTITY, realtime revocation, device activity |
| 333 | Two-factor authentication decision | 4 | 3 | 2 | 2 | 5 | P1 | threat model, Supabase capability/licensing review |
| 334 | Social-login provider finalization | 3 | 4 | 3 | 4 | 5 | P2 | LEGAL, IDENTITY, redirect/security review |
| 335 | Steam login proof of concept | 2 | 4 | 4 | 3 | 5 | P3 | 334 decision, provider terms; isolated experiment only |
| 336 | Epic login proof of concept | 2 | 4 | 4 | 3 | 5 | P3 | 334 decision, provider terms; isolated experiment only |

## Strategy, accessibility and final hardening (337-350)

| Task | Feature | V | R | C | Rev | Sec | Priority | Dependencies |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 337 | Mobile strategy reassessment | 1 | 4 | 2 | 3 | 2 | P3 | desktop success evidence; no mobile implementation |
| 338 | Web-app strategy reassessment | 1 | 4 | 2 | 3 | 4 | P3 | desktop success and CSP/auth threat review; no web implementation |
| 339 | Accessibility remediation pass | 5 | 3 | 4 | 2 | 3 | P0 | keyboard/screen-reader audit, overlay inventory |
| 340 | Reduced motion/high contrast final | 5 | 2 | 3 | 2 | 2 | P0 | design tokens, persisted settings |
| 341 | Localization QA extended | 4 | 3 | 4 | 3 | 2 | P1 | translation coverage, Turkish/English fixtures |
| 342 | Time-zone/event formatting final | 4 | 3 | 3 | 2 | 3 | P1 | locale service, DST/event fixtures |
| 343 | Desktop display-scaling QA | 5 | 3 | 4 | 2 | 2 | P0 | Windows/Linux/macOS scale and monitor matrix |
| 344 | Overlay-stack final audit | 5 | 3 | 4 | 1 | 3 | P0 | overlay manager, keyboard/focus tests |
| 345 | Memory-leak extended audit | 5 | 4 | 5 | 1 | 3 | P0 | long-run harness, realtime/media listener inventory |
| 346 | Startup-performance optimization final | 5 | 4 | 5 | 3 | 2 | P1 | performance budget and profiling evidence |
| 347 | Bundle splitting/lazy loading | 4 | 4 | 4 | 2 | 3 | P1 | 346 measurements; preserve Electron file routing |
| 348 | Error-boundary UX final | 5 | 3 | 3 | 1 | 4 | P0 | redacted diagnostics, recovery actions |
| 349 | Safe-mode final test | 5 | 4 | 4 | 1 | 4 | P0 | packaged build, corrupted-state fixtures |
| 350 | Final long-term backlog audit | 5 | 2 | 3 | 1 | 4 | P0 | completion/evidence from all approved predecessors |

## Execution policy

1. P0 does not mean parallel implementation. Each task keeps the one-task/test/commit/push discipline.
2. Hosted security work cannot be marked complete from mock tests alone.
3. High-security-risk work requires negative authorization tests and redacted evidence.
4. P2/P3 work must not displace unresolved P0 release blockers.
5. Proofs of concept must remain isolated and disabled in production.
6. Mobile and web strategy tasks may produce decisions only; Picom remains desktop-only unless governance explicitly changes the scope.
7. Re-score the matrix after hosted staging evidence, user research or a material product/market change.

## Recommended critical path

The first release-quality sequence is: permission/public-read review (261, 263), privacy and realtime hardening (268, 275), invite/join authorization (279-280), legal versioning (286-287), voice recovery if voice ships (295-296), packaging and desktop security (301-305, 308-312), hosted Supabase evidence (313-323), account privacy/security completion (326, 328-332), and final accessibility/runtime audits (339-345, 348-350).

This path does not authorize production launch; the Go/No-Go decision still requires objective evidence from staging, package signing/notarization, restore drills, monitoring and legal approval.
