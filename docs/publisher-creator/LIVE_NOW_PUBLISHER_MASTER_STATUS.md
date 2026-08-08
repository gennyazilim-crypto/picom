# LIVE NOW / PUBLISHER MASTER STATUS

Updated: 20260808T181500Z
Branch: release/picom-canonical-production
Authoritative base HEAD: 58ab7322416720836a27d13cd4ea44a1d3f8fa7b
Prior partial tag (unchanged): picom-publisher-phase1-production-partial-20260803T230959Z

| TASK | STATUS | TESTS | BLOCKER |
|------|--------|-------|---------|
| 00-16 prior Phase1 | see prior | external runtime sealed | - |
| 25 External runtime | GO_PARTIAL | LiveKit/SMTP/workers | media tracks headless |
| 26 Real-device cert | PARTIAL | Storage closed-deny GO | Media two-desktop NOT_CERTIFIED; Auth inbox BLOCKED_RATE_LIMIT |
| 27 Stream management | PARTIAL | schema/RLS/smoke/ingress preflight GO | OBS real client NOT_RUN; flags OFF; ingest DNS pending |

## Feature flags (production)
- Application/Review/Badge/Discovery/Go Live/Reminders/Notification Preferences: ON
- enablePublisherStreamManagement: **OFF**
- enablePublisherExternalIngest: **OFF**

## TASK26 results (unchanged — not fake-passed by TASK27)
- Closed application storage denial: GO
- Auth verification inbox: BLOCKED_RATE_LIMIT
- Auth password reset inbox: BLOCKED_RATE_LIMIT
- Real two-desktop mic/camera/screen: NOT_CERTIFIED

## TASK27 results
- Migration `20260808170000_publisher_stream_management` applied on cqnsetsmcduraryemhbi
- Hashed stream credentials + server-side state machine + audit/rate limits
- LiveKit Ingress `picom-livekit-ingress` v1.4.2 on VPS; RTMP :1935 UFW open
- Webhook retargeted to production `livekit-webhook`
- Edge: `livekit-ingress`, `livekit-webhook`, `client-config` deployed
- OBS real Studio client: NOT_RUN
- External ingest protocol (TCP/container/webhook wiring): GO
- RTMP base currently `rtmp://23.254.166.240/live` (`ingest.picom.gg` DNS not published)

## Evidence
- TASK26: docs/audit/evidence/live-now-publisher-real-device-certification-2026-08-03T2252Z/
- TASK27: docs/audit/evidence/live-now-stream-management-20260808T163710Z/

## Verdict
PICOM STREAM MANAGEMENT CODE: GO
PICOM STREAM MANAGEMENT RLS: GO
PICOM STREAM STATE MACHINE: GO
PICOM STREAM CREDENTIAL SECURITY: GO
PICOM STREAM KEY ROTATE/REVOKE: GO (RPC + edge path)
PICOM LIVEKIT EXTERNAL INGEST: GO
PICOM OBS CONNECTION MODEL: GO
PICOM STREAM HEALTH: GO (webhook-backed; no fake metrics)
PICOM LIVE NOW INTEGRATION: GO
PICOM STREAM MANAGEMENT 10 LOCALE: GO
PICOM EXTERNAL INGEST PROTOCOL: GO
PICOM OBS REAL CLIENT CERTIFICATION: NOT_RUN
PICOM STREAM MANAGEMENT PRODUCTION: PARTIAL_OBS_CLIENT_CERTIFICATION
PICOM PHASE 1 REAL TWO-DESKTOP MEDIA: NOT_CERTIFIED
PICOM AUTH INBOX ASSERTION: BLOCKED_RATE_LIMIT
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL_EMAIL_AND_MEDIA_CERTIFICATION
