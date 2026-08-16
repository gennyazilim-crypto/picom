# Live Now / Publisher Release Readiness

Authoritative contracts: `src/services/ops/liveNowReleaseReadiness.ts`  
Task34 must not silently upgrade historical blockers.

## Gate matrix

| COMPONENT | CODE | DATABASE | RLS | UNIT/STATIC | PRODUCTION_RUNTIME | REAL_CLIENT | EXTERNAL_PROVIDER | FEATURE_FLAG | FINAL |
|-----------|------|----------|-----|-------------|--------------------|-------------|-------------------|--------------|-------|
| Publisher Applications | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| Publisher Review | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| Badge | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| Live Now Discovery | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| Go Live | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| LiveKit Signaling | GO | N/A | N/A | GO | FAIL | NOT_RUN | FAIL | N/A | BLOCKED |
| Real Media | GO | N/A | N/A | PARTIAL | BLOCKED | NOT_RUN | GO | N/A | BLOCKED |
| OBS | GO | GO | GO | GO | PARTIAL | NOT_RUN | PARTIAL | OFF | BLOCKED |
| Chat | GO | GO | GO | GO | PARTIAL | NOT_RUN | N/A | OFF | PARTIAL |
| Analytics | GO | GO | GO | GO | PARTIAL | NOT_RUN | N/A | OFF | PARTIAL |
| Recording | GO | GO | GO | GO | BLOCKED | NOT_RUN | BLOCKED | OFF | BLOCKED |
| Replay/Clips | GO | GO | GO | GO | BLOCKED | NOT_RUN | BLOCKED | OFF | BLOCKED |
| Creator Studio | GO | GO | GO | GO | PARTIAL | PARTIAL | N/A | OFF | PARTIAL |
| Monetization | GO | GO | GO | GO | BLOCKED | NOT_RUN | NOT_CONFIGURED | OFF | BLOCKED |
| KYC | GO | GO | GO | GO | BLOCKED | NOT_RUN | NOT_CONFIGURED | OFF | BLOCKED |
| Payout | GO | GO | GO | GO | BLOCKED | NOT_RUN | NOT_CONFIGURED | OFF | BLOCKED |
| Operations | GO | GO | GO | GO | PARTIAL | N/A | NOT_CONFIGURED | N/A | PARTIAL |
| DR | GO | PARTIAL | N/A | GO | PARTIAL | N/A | PARTIAL | N/A | PARTIAL |

## Release tiers

| Tier | Verdict | Rationale |
|------|---------|-----------|
| INTERNAL | **GO** | Ops contracts + sealed Phase1 schema; flags OFF |
| CONTROLLED_BETA | **BLOCKED** | Current certification package cannot reach `voice.picom.gg:443`; real LiveKit client verification cannot begin. |
| PUBLIC_BETA | **BLOCKED** | Current WSS failure, media/OBS/chat/analytics two-client gaps, and provider gates remain. |
| GENERAL_AVAILABILITY | **BLOCKED** | Historical Task26–33 blockers remain open |

## Historical blockers (unchanged)

- REAL TWO-DESKTOP MEDIA: NOT_CERTIFIED
- AUTH INBOX: BLOCKED_RATE_LIMIT
- OBS REAL CLIENT: NOT_RUN
- CHAT TWO-CLIENT: NOT_RUN
- ANALYTICS MULTI-VIEWER: NOT_RUN
- LIVEKIT EGRESS: BLOCKED_INFRASTRUCTURE
- MEDIA STORAGE: BLOCKED_STORAGE_CREDENTIAL
- PAYMENT PROVIDER: BLOCKED_PROVIDER_CONFIGURATION
- LIVE PAYMENT: OFF
- LEGAL: BLOCKED_CONTENT_APPROVAL
- KYC PROVIDER: NOT_CONFIGURED
- PAYOUT PROVIDER: NOT_CONFIGURED
- LIVE PAYOUT: OFF
- TAX ENGINE: BLOCKED_LEGAL_PROVIDER_CONFIGURATION
- CREATOR STUDIO SECURITY CENTER: PARTIAL_AUTH_PROVIDER_CAPABILITY
- CREATOR STUDIO PRODUCTION: PARTIAL_RUNTIME_TEAM_CERTIFICATION

## Task38 runtime-provisioning evidence (20260816T120423Z)

- Canonical HEAD `a99135729a7098cd841b84688cb7ac056346da8d` was used. The supplied installer SHA-256 matches its authoritative value but the package fails closed before sign-in because its public renderer environment is absent.
- A separate current package from the same canonical HEAD, with only public production renderer configuration, authenticated seven separate internal test users in isolated packaged Desktop profiles. The test users are recorded in `platform_stats_exclusions` with reason `test`; credentials are Windows-DPAPI protected and absent from evidence.
- DNS for `voice.picom.gg` resolved to `23.254.166.240`; TCP `443`, `7880`, `7881`, `5349` failed and HTTPS timed out. A configured SSH identity exists, but port `22` also times out, so no deployed Nginx, firewall, LiveKit, or TURN mutation is claimed.
- The approved Auth mailbox path depends on the unreachable VPS. No verification or password-reset message was sent.
- Full evidence: `docs/audit/evidence/live-now-task38-runtime-provisioning-20260816T120423Z/`.
