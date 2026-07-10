# Final long-term backlog audit

Audit date: 2026-07-10  
Scope: Tasks 251-349  
Product scope: Picom Electron desktop for Windows, Linux and macOS; no mobile implementation.

## Executive result

- Source briefs audited: **99**.
- Required task checkpoints present: **99/99**.
- Task-specific Git commits present: **99/99**.
- Delivery result: every task from 251 through 349 has a committed checkpoint and an explicit implementation, test, documentation, deferral or rejection outcome.
- This does **not** mean every hosted/platform release gate passed. Supabase staging, native package hosts, signing, LiveKit multi-client tests and physical accessibility/performance checks remain separated below.

Status definitions:

- **Delivery-complete:** the requested local change or decision artifact, checkpoint and commit exist.
- **Blocked external evidence:** local preparation is complete, but the required hosted account, credential-free fixture, OS host or operator approval was unavailable.
- **Deferred:** deliberately not enabled or implemented until a documented gate is satisfied.
- **Rejected:** an approach was explicitly ruled out; no task was silently discarded.

## Completed delivery ledger

Every item in this table is delivery-complete. The later sections qualify external evidence and deferred production enablement.

| Tasks | Completed task titles |
|---|---|
| 251-260 | 251 V3 roadmap governance lock; 252 V3 product strategy review; 253 User segmentation and personas; 254 Competitive analysis refresh; 255 Feature prioritization matrix; 256 Growth onboarding experiments plan; 257 Referral and invite growth system plan; 258 Community quality ranking plan; 259 Creator/community owner toolkit plan; 260 Moderator workflow v3 plan. |
| 261-270 | 261 Advanced permission model review; 262 Channel permission overrides plan; 263 Public read-only community hardening; 264 Mention Feed Supabase production integration; 265 Stories header Supabase integration; 266 Profile activity Supabase integration; 267 Profile follow/unfollow persistence; 268 Profile privacy settings implementation; 269 Message mentions extraction pipeline; 270 Reply system production persistence. |
| 271-280 | 271 Emoji picker production polish; 272 Reaction analytics-safe summaries; 273 Comment preview production model; 274 Message editing conflict handling; 275 Realtime event deduplication hardening; 276 Unread and read-state production integration; 277 Notification inbox production integration; 278 Quiet hours and DND enforcement; 279 Community invite acceptance production; 280 Join community public flow production. |
| 281-290 | 281 Community role assignment UI; 282 Community settings persistence; 283 Channel create/edit/delete polish; 284 Member management MVP polish; 285 Community audit log viewer; 286 Legal acceptance tracking; 287 Policy versioning; 288 Age and eligibility gate plan; 289 Content reporting UX polish; 290 Block and mute UX polish. |
| 291-300 | 291 Search command palette production; 292 Keyboard shortcut finalization; 293 Settings menu completeness review; 294 Voice device selection production; 295 Voice reconnect and recovery; 296 Screen share permission recovery; 297 Voice mini card production integration; 298 Active voice rooms discovery; 299 Screen share preview and stop controls; 300 LiveKit production capacity notes. |
| 301-310 | 301 Windows packaging QA extended; 302 Linux packaging QA extended; 303 macOS packaging QA extended; 304 Release artifact naming and versioning; 305 Release checksums and provenance; 306 Beta distribution portal/process; 307 Support diagnostics UX final; 308 Logs redaction regression test; 309 Security headers and CSP production; 310 Electron preload API contract freeze. |
| 311-320 | 311 IPC fuzz and invalid payload checks; 312 Safe external links production test; 313 Supabase environment validation final; 314 Supabase CLI setup docs and fallback; 315 RLS hosted staging validation; 316 Storage signed URL/private access review; 317 Realtime staging validation; 318 Edge Functions staging validation; 319 Supabase backup and PITR review; 320 Database migration rollback drill. |
| 321-330 | 321 Production data seeding policy; 322 Admin bootstrap production process; 323 Rate limit staging validation; 324 Abuse event dashboard polish; 325 Community guidelines acceptance flow; 326 Content deletion and retention user messaging; 327 Message export admin policy; 328 Data export real implementation; 329 Account deletion real implementation; 330 Password reset production. |
| 331-340 | 331 Email verification production; 332 Session management production; 333 Two-factor authentication decision; 334 Social login provider finalization; 335 Steam login proof of concept; 336 Epic login proof of concept; 337 Mobile strategy reassessment; 338 Web app strategy reassessment; 339 Accessibility remediation pass; 340 Reduced motion/high contrast final. |
| 341-349 | 341 Localization QA extended; 342 Time zone and event formatting final; 343 Desktop display scaling QA; 344 Overlay stack final audit; 345 Memory leak extended audit; 346 Startup performance optimization final; 347 Bundle splitting and lazy loading; 348 Error boundary UX final; 349 Safe mode final test. |

## Blocked external evidence

These tasks are delivery-complete locally but their named external proof is blocked or not runnable in the current Windows workspace.

| Tasks | Blocker | Required evidence |
|---|---|---|
| 315-318, 323 | No approved Supabase staging URL/anon key, synthetic users/fixtures or available Supabase CLI session. | Run hosted RLS, private Storage, Realtime, Edge Function and rate-limit suites without service-role leakage. |
| 320 | No approved staging restore target, backup/PITR point, CLI/operator window or rollback approval. | Execute the migration rollback drill against disposable staging and record timings/data checks. |
| 302 | Linux packaging from Windows is blocked by symlink/fpm host requirements. | Build AppImage/deb on a supported Linux runner and complete install/uninstall smoke. |
| 303 | electron-builder cannot build macOS DMG/zip on Windows. | Build, sign, notarize and smoke-test on a supported macOS runner. |
| 301 | Windows artifact exists, but clean-machine install/uninstall/reinstall evidence is manual. | Run the packaged candidate on a clean Windows VM/device and archive screenshots/logs. |
| 294-300 | No approved LiveKit/Supabase two-client staging credentials and physical media-device matrix in this audit. | Run voice reconnect, device switch, screen-share permission/stop and capacity tests. |
| 330-334 | Email/social provider hosted configuration and certification are not available. | Certify reset, verification, session revoke and approved Google/Apple provider flows before enablement. |
| 339-347 | Physical assistive-technology, multi-monitor/DPI, packaged heap/cold-start and complete overlay evidence cannot be proven statically. | Execute the documented Windows/Linux/macOS release-candidate matrices. |

Additional hosted verification remains pending for Supabase-backed work in 263-268, 275-291, 324 and 328-332. Their local contracts/builds passed, but no checkpoint claims hosted RLS as passed.

## Deferred outcomes

- **261 Advanced permission model:** schema/RLS migration is deferred until explicit approval and hosted boundary tests exist.
- **319-322 Production operations:** PITR purchasing/approval, restore execution, production seed execution and first-admin bootstrap execution remain operator gates.
- **326 Retention periods:** final public/legal retention durations remain under policy review.
- **329 Account deletion:** destructive finalization stays disabled until hosted, legal and operations approval.
- **331 Email verification:** enforcement stays disabled until provider certification.
- **333 Two-factor authentication:** production implementation is intentionally deferred; placeholders are not security enforcement.
- **334 Social login:** code is prepared; providers remain disabled until hosted certification.
- **335-336 Steam/Epic login:** proof-of-concept architecture is documented; production provider work is deferred pending product/security approval.
- **337 Mobile:** implementation remains out of scope for the desktop product.
- **338 Public web app:** distribution remains deferred; web-first/mobile layouts are not introduced.
- **345-347 Performance:** packaged heap/cold-start evidence and a measured shared `voiceService` boundary refactor remain deferred to release-candidate profiling.

## Rejected decisions

No task was rejected without a checkpoint. The following approaches were explicitly rejected during the tasks:

- Treating `manageCommunity` alone as sufficient permission for message-history export (Task 327).
- Treating 2FA, Steam or Epic placeholders as production authentication/security enforcement (Tasks 333, 335, 336).
- Shipping mobile or public web clients as part of the current desktop roadmap (Tasks 337, 338).
- Applying a broad permission-schema migration without approved RLS design and hosted isolation evidence (Task 261).
- Hiding the Vite 500 kB warning by increasing the threshold without measured startup benefit (Tasks 346, 347).
- Claiming Windows-hosted Linux/macOS package attempts or absent Supabase staging runs as successful (Tasks 302, 303, 315-318, 320, 323).

## Next 20 highest-value tasks

| Priority | Category | Next task | Closes / depends on | Done when |
|---:|---|---|---|---|
| 1 | Security | Provision a locked synthetic Supabase staging test environment | 313-318, 323 | Named staging owner, CLI/project link, anon-only fixtures and secret handling are approved. |
| 2 | Security | Execute the full hosted RLS role/isolation matrix | 261, 263-291, 315 | Anonymous/member/mod/admin/owner tests pass for public/private community, channel, message and member data. |
| 3 | Security | Execute private Storage signed-URL/access tests | 316 | Unauthorized reads/uploads fail; signed URL expiry and private attachment access pass. |
| 4 | Security | Deploy and validate Edge Functions in staging | 318 | Auth/CORS/schema/idempotency/rate-limit tests pass for implemented functions; placeholders stay disabled. |
| 5 | Security | Validate rate limits and abuse logging under load | 323-324 | Auth, invite, search, upload and webhook thresholds emit safe abuse evidence without leaking content. |
| 6 | Security | Certify session revoke across Auth and Realtime | 332 | Revoked sessions fail API access and connected sockets disconnect in two clients. |
| 7 | Product | Certify password reset and email verification | 330-331 | Real provider links, expiry, resend, recovery and verification enforcement pass in staging. |
| 8 | Product | Certify data export and account deletion end to end | 328-329 | Export excludes secrets; revoke/anonymize/owned-community/finalization flows pass with audit integrity. |
| 9 | Product | Run two-window Realtime/read/notification QA | 275-280, 317 | No duplicate messages, stable ordering, read state and notification routing pass across reconnect. |
| 10 | Product | Run voice and screen-share device matrix | 294-300 | Join/leave/mute/deafen/reconnect/device switch/share/permission recovery pass on all three desktop OSes. |
| 11 | Operations | Complete clean Windows package smoke | 301, 304-306 | Install, first launch, upgrade/reinstall, uninstall, checksum and provenance evidence are archived. |
| 12 | Operations | Build and test Linux artifacts on Linux CI/host | 302 | AppImage and deb install/launch/uninstall pass with documented distro/FUSE assumptions. |
| 13 | Operations | Build, sign and notarize macOS artifacts on macOS | 303 | DMG/zip launch, permissions, Gatekeeper, signing and notarization checks pass. |
| 14 | Operations | Approve backup/PITR policy and run restore verification | 319 | RPO/RTO, backup ownership, restore integrity and alerting evidence are accepted. |
| 15 | Operations | Execute the staging migration rollback drill | 320 | Pre-backup, forward migration, failure/rollback limits and desktop compatibility smoke are recorded. |
| 16 | Operations | Execute production seed/admin bootstrap rehearsal | 321-322 | Idempotent seed and explicit admin creation run in disposable staging without logging credentials. |
| 17 | Product | Complete accessibility/localization/display release QA | 339-344 | Narrator/Orca/VoiceOver, EN/TR overflow, timezone, DPI, multi-monitor and overlay checks pass. |
| 18 | Operations | Capture packaged memory and cold-start baselines | 345-347 | Windows/Linux/macOS median/p95 startup and long-run heap meet budget; regressions have owners. |
| 19 | Enterprise | Approve the advanced RBAC/override model | 261-262 | Permission vocabulary, precedence, migration and RLS ownership are accepted with backward compatibility. |
| 20 | Enterprise | Approve retention, audit and destructive-account governance | 285, 319, 326-329 | Legal/operations owners approve retention periods, immutable evidence, deletion finalization and support runbooks. |

## Category view

### Product

Priorities 7-10 and 17 close the highest-impact user journeys: account recovery, privacy workflows, reliable messaging, voice/screen share and desktop accessibility/localization.

### Security

Priorities 1-6 are the immediate release blockers. Frontend behavior and static SQL inspection are not substitutes for hosted role, Storage, Edge Function, abuse and session-revoke evidence.

### Operations

Priorities 11-16 and 18 produce installable cross-platform artifacts, recoverable data, controlled bootstrap and measured performance. These require real OS runners and operator evidence.

### Enterprise

Priorities 19-20 remain behind product-market and governance approval. Do not expand enterprise UI before RBAC, retention, audit and destructive-workflow policy is accepted.

## Recommended execution rule

Do not begin new marketplace, plugin, bot, billing, mobile or public-web scope. First unblock synthetic staging and cross-platform release runners, execute priorities 1-18, and update each existing checkpoint with external evidence. Enterprise priorities 19-20 can proceed as architecture/approval work but should not bypass launch-critical security and operations proof.
