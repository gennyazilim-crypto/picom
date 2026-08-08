# LIVE NOW / PUBLISHER MASTER STATUS

Updated: 20260808T191500Z
Branch: release/picom-canonical-production
Authoritative TASK28 base HEAD: 4791e7004a0d35534957b93bf883359b7df832c3
Prior partial tag (unchanged): picom-publisher-phase1-production-partial-20260803T230959Z

| TASK | STATUS | TESTS | BLOCKER |
|------|--------|-------|---------|
| 00-16 prior Phase1 | see prior | external runtime sealed | - |
| 25 External runtime | GO_PARTIAL | LiveKit/SMTP/workers | media tracks headless |
| 26 Real-device cert | PARTIAL | Storage closed-deny GO | Media two-desktop NOT_CERTIFIED; Auth inbox BLOCKED_RATE_LIMIT |
| 27 Stream management | PARTIAL | schema/RLS/smoke/ingress preflight GO | OBS real client NOT_RUN; flags OFF; ingest DNS pending |
| 28 Live chat + moderation | PARTIAL | schema/RLS/static smoke GO | Two-client runtime PARTIAL/NOT_RUN; flags OFF |

## Feature flags (production)
- Application/Review/Badge/Discovery/Go Live/Reminders/Notification Preferences: ON
- enablePublisherStreamManagement: **OFF**
- enablePublisherExternalIngest: **OFF**
- enableLiveChat: **OFF**
- enableLiveModeration: **OFF**

## TASK26 results (unchanged)
- Closed application storage denial: GO
- Auth verification/reset inbox: BLOCKED_RATE_LIMIT
- Real two-desktop mic/camera/screen: NOT_CERTIFIED

## TASK27 results (unchanged)
- OBS REAL CLIENT CERTIFICATION: NOT_RUN
- STREAM MANAGEMENT PRODUCTION: PARTIAL_OBS_CLIENT_CERTIFICATION

## TASK28 results
- Migrations `20260808200000` + `20260808210000` on cqnsetsmcduraryemhbi
- Dedicated live_chat_* schema, RPC-only mutations, RLS select policies
- Server rate limit / slow mode / anti-spam / ban / timeout / pin / reports / audit
- Client: liveChatService, LiveStreamChatPanel, LiveChatModeratorConsole, 10-locale catalog
- Realtime publication wired; authenticated two-client runtime: NOT_RUN / PARTIAL

## Evidence
- TASK26: docs/audit/evidence/live-now-publisher-real-device-certification-2026-08-03T2252Z/
- TASK27: docs/audit/evidence/live-now-stream-management-20260808T163710Z/
- TASK28: docs/audit/evidence/live-now-chat-moderation-20260808T184425Z/

## Verdict (cumulative)
PICOM LIVE CHAT CODE: GO
PICOM LIVE CHAT DATABASE: GO
PICOM LIVE CHAT RLS: GO
PICOM LIVE CHAT REALTIME: PARTIAL
PICOM LIVE CHAT RATE LIMIT: GO
PICOM LIVE CHAT SLOW MODE: GO
PICOM LIVE CHAT MODERATOR ROLES: GO
PICOM LIVE CHAT TIMEOUT: GO
PICOM LIVE CHAT BAN: GO
PICOM LIVE CHAT MESSAGE REMOVAL: GO
PICOM LIVE CHAT PINNING: GO
PICOM LIVE CHAT ANTI-SPAM: GO
PICOM LIVE CHAT XSS SECURITY: GO
PICOM LIVE CHAT REPORTING: GO
PICOM LIVE CHAT 10 LOCALE: GO
PICOM LIVE CHAT PRODUCTION: PARTIAL_RUNTIME_CERTIFICATION
PICOM OBS REAL CLIENT CERTIFICATION: NOT_RUN
PICOM PHASE 1 REAL TWO-DESKTOP MEDIA: NOT_CERTIFIED
PICOM AUTH INBOX ASSERTION: BLOCKED_RATE_LIMIT
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL_EMAIL_AND_MEDIA_CERTIFICATION
