# LIVE NOW / PUBLISHER MASTER STATUS

Updated: 20260816T120423Z (Task38 runtime infrastructure and provisioning sweep)
Branch: release/picom-canonical-production
Authoritative TASK38 HEAD: a99135729a7098cd841b84688cb7ac056346da8d
Prior partial tag (unchanged): picom-publisher-phase1-production-partial-20260803T230959Z

| TASK | STATUS | TESTS | BLOCKER |
|------|--------|-------|---------|
| 00-16 prior Phase1 | see prior | external runtime sealed | - |
| 25 External runtime | GO_PARTIAL | LiveKit/SMTP/workers | media tracks headless |
| 26 Real-device cert | PARTIAL | Storage closed-deny GO | Media two-desktop NOT_CERTIFIED; Auth inbox BLOCKED_RATE_LIMIT |
| 27 Stream management | PARTIAL | schema/RLS/smoke/ingress preflight GO | OBS real client NOT_RUN; flags OFF; ingest DNS pending |
| 28 Live chat + moderation | PARTIAL | schema/RLS/static smoke GO | Two-client runtime PARTIAL/NOT_RUN; flags OFF |
| 29 Publisher analytics | PARTIAL | schema/RLS/static reconciliation GO | Multi-viewer runtime NOT_RUN; flag OFF |
| 30 Recording/replay/clips | PARTIAL | schema/RLS/static smoke GO | Egress NOT deployed; S3 credentials missing; flags OFF |
| 31 Publisher monetization | PARTIAL | schema/RLS/static ledger smoke GO | Provider NOT_CONFIGURED; legal terms; flags OFF |
| 32 KYC / tax / payouts | PARTIAL | schema/RLS/static payout smoke GO | KYC/Payout provider NOT_CONFIGURED; legal/tax gates; flags OFF |
| 33 Creator Studio unification | PARTIAL | schema/RLS/static RBAC smoke GO | enableCreatorStudio OFF; child flags OFF; session enum PARTIAL |
| 34 Production ops / SLO / DR | PARTIAL | ops contracts + smokes | Alert transport NOT_CONFIGURED; SLO history insufficient; restore drill NOT_RUN |

## Feature flags (production)
- enableCreatorStudio: **OFF**
- Task27–32 child flags remain **OFF**
- Task34 did **not** enable features merely to probe

## TASK26–33 historical blockers (unchanged by Task34)
- REAL TWO-DESKTOP MEDIA: NOT_CERTIFIED
- AUTH INBOX: BLOCKED_RATE_LIMIT
- OBS REAL CLIENT: NOT_RUN
- CHAT TWO-CLIENT: NOT_RUN
- ANALYTICS MULTI-VIEWER: NOT_RUN
- LIVEKIT EGRESS: BLOCKED_INFRASTRUCTURE
- MEDIA STORAGE: BLOCKED_STORAGE_CREDENTIAL
- PAYMENT PROVIDER: BLOCKED_PROVIDER_CONFIGURATION
- LIVE PAYMENT: OFF
- LEGAL TERMS: BLOCKED_CONTENT_APPROVAL
- KYC PROVIDER: NOT_CONFIGURED
- PAYOUT PROVIDER: NOT_CONFIGURED
- LIVE PAYOUT: OFF
- TAX ENGINE: BLOCKED_LEGAL_PROVIDER_CONFIGURATION
- CREATOR STUDIO SECURITY CENTER: PARTIAL_AUTH_PROVIDER_CAPABILITY
- CREATOR STUDIO PRODUCTION: PARTIAL_RUNTIME_TEAM_CERTIFICATION

## TASK34 results
- Migration `20260808430000_live_now_production_ops.sql`
- Health model + service catalog + Root status aggregator
- Structured logging + correlation contracts
- SLO/SLI definitions with INSUFFICIENT_OBSERVATION_WINDOW
- Alert rules GO; ALERT_TRANSPORT NOT_CONFIGURED
- Security/abuse monitoring contracts
- Live Now emergency kill switches
- Release readiness matrix + DR/incident docs
- Canaries separated (signaling ≠ media/OBS/chat/analytics/recording)

## Release tier verdicts (Task34)
- INTERNAL: **GO**
- CONTROLLED_BETA: **BLOCKED** (current certification client cannot reach `voice.picom.gg:443`)
- PUBLIC_BETA: **BLOCKED** (current WSS failure and real-client gates remain unproven)
- GENERAL_AVAILABILITY: **BLOCKED**

## Task38 runtime infrastructure and provisioning sweep
- The authoritative installer SHA-256 remains `15A1C11F2CE2BCF8B371BEF06CC6DA486E37A58094342241F26EB29BCD1AA2EC`, but it stops fail-closed before sign-in because public renderer configuration is absent. A separate same-HEAD runtime test package with public production configuration authenticated successfully; both artifacts are **NotSigned**.
- LiveKit client network remains **FAIL**: DNS resolves to `23.254.166.240`; TCP `443`, `7880`, `7881`, `5349` and HTTPS fail/time out. A configured SSH identity exists, but port `22` times out, so deployed Nginx, firewall, LiveKit and TURN are still uninspected.
- **TEST_IDENTITIES=GO**: PUBLISHER_A, VIEWER_B, VIEWER_C, TEAM_OWNER, TEAM_MANAGER, TEAM_ANALYST and TEAM_FINANCE are real, distinct internal production Auth subjects. They are excluded from public metrics through service-role-only `platform_stats_exclusions` records; credentials are Windows-DPAPI protected.
- **AUTH_SESSION_ISOLATION=GO**: seven separate current packaged-desktop profiles authenticated as their expected distinct subjects and were cleaned up.
- Hardware and OBS remain inventory-only. Actual microphone, camera, screen-share, OBS/Ingress, analytics and Creator Studio stream runtime remain **BLOCKED_RUNTIME_PREREQUISITES** pending external WSS/RTC reachability. The existing Auth inbox mechanism is blocked by the same VPS reachability issue; no email was sent.
- Unchanged external blockers remain: Egress, media storage, payments, legal, KYC/payouts, and tax engine.

## Evidence
- TASK32: docs/audit/evidence/live-now-publisher-kyc-payout-20260809T170836Z/
- TASK33: docs/audit/evidence/creator-studio-unification-20260809T184359Z/
- TASK34: docs/audit/evidence/live-now-production-operations-<UTC>/
- Task38 runtime provisioning: docs/audit/evidence/live-now-task38-runtime-provisioning-20260816T120423Z/
