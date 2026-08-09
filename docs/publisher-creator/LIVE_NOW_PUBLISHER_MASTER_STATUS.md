# LIVE NOW / PUBLISHER MASTER STATUS

Updated: 20260809T150000Z
Branch: release/picom-canonical-production
Authoritative TASK30 base HEAD: 96edd00833acbfbb5f2f1b02f1039cec574f3a6e
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

## Feature flags (production)
- Application/Review/Badge/Discovery/Go Live/Reminders/Notification Preferences: ON
- enablePublisherStreamManagement: **OFF**
- enablePublisherExternalIngest: **OFF**
- enableLiveChat: **OFF**
- enableLiveModeration: **OFF**
- enablePublisherAnalytics: **OFF**
- enableLiveRecording: **OFF**
- enableLiveReplays: **OFF**
- enableLiveClips: **OFF**

## TASK26 results (unchanged)
- Closed application storage denial: GO
- Auth verification/reset inbox: BLOCKED_RATE_LIMIT
- Real two-desktop mic/camera/screen: NOT_CERTIFIED

## TASK27 results (unchanged)
- OBS REAL CLIENT CERTIFICATION: NOT_RUN

## TASK28 results (unchanged)
- Two-client chat runtime: NOT_RUN

## TASK29 results (unchanged)
- Analytics multi-viewer runtime: NOT_RUN
- PRODUCTION: PARTIAL_RUNTIME_EVENT_CERTIFICATION

## TASK30 results
- Migrations `20260808270000` + `20260808280000` + `20260808290000` sealed
- Recording/replay/clip schema + RLS + signed playback claim RPC
- Edge `publisher-recording` fail-closed without Egress/S3
- Webhook egress event mapping wired
- Archive UI + 10-locale catalog (flag-gated)
- Media worker stub (ffmpeg/storage pending)
- VPS capacity: 2 vCPU — Egress not deployed on SFU host
- REAL DESKTOP RECORDING: NOT_CERTIFIED
- SYNTHETIC MEDIA PIPELINE: NOT_RUN (provider blocked)
- OBS_REAL_CLIENT_RECORDING: NOT_RUN
- PRODUCTION: PARTIAL_INFRASTRUCTURE

## Evidence
- TASK26: docs/audit/evidence/live-now-publisher-real-device-certification-2026-08-03T2252Z/
- TASK27: docs/audit/evidence/live-now-stream-management-20260808T163710Z/
- TASK28: docs/audit/evidence/live-now-chat-moderation-20260808T184425Z/
- TASK29: docs/audit/evidence/live-now-publisher-analytics-20260809T092950Z/
- TASK30: docs/audit/evidence/live-now-recording-replay-clips-20260809T143230Z/

## Verdict (cumulative)
PICOM LIVE RECORDING CODE: GO
PICOM LIVE RECORDING RLS: GO
PICOM LIVEKIT EGRESS: BLOCKED_INFRASTRUCTURE
PICOM MEDIA STORAGE: BLOCKED_STORAGE_CREDENTIAL
PICOM RECORDING FEATURE: OFF
PICOM RECORDING PRODUCTION: PARTIAL_INFRASTRUCTURE
PICOM ANALYTICS MULTI-VIEWER RUNTIME: NOT_RUN
PICOM LIVE CHAT TWO-CLIENT RUNTIME: NOT_RUN
PICOM OBS REAL CLIENT CERTIFICATION: NOT_RUN
PICOM PHASE 1 REAL TWO-DESKTOP MEDIA: NOT_CERTIFIED
PICOM AUTH INBOX ASSERTION: BLOCKED_RATE_LIMIT
