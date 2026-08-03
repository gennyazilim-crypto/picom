# LIVE NOW / PUBLISHER MASTER STATUS

Updated: 20260803T222116Z
Branch: release/picom-canonical-production
HEAD: 5b69a0eb6e6783a4cb1a07a45895a3024aeee3f7
Production: cqnsetsmcduraryemhbi
Sanitized remote: GO

| TASK | STATUS | TESTS | BLOCKER |
|------|--------|-------|---------|
| 00 Master control | GO | status table sealed | - |
| 01 GH001 + remote | GO | push+tag+large-file | - |
| 02 Auth + SMTP | GO_PARTIAL | Auth SMTP configured verify@; worker SMTP healthy | Auth delivery rate-limited in smoke; mailbox not inbox-asserted |
| 03 Storage | PARTIAL | own upload + foreign deny PASS | closed-application upload deny FAIL (policy/race finding) |
| 04 Realtime app | GO | RLS+policies+tables | Dual WS optional |
| 05 Workers | GO | claim RPC + VPS workers on production ref | - |
| 06 Test accounts | GO | internal create/cleanup | - |
| 07 JWT/RLS | GO | anon/user deny matrix | - |
| 08 Case04 | GO | SQL boundary PASS | - |
| 09 Case18 | GO | SQL discovery PASS | - |
| 10 Badge revocation | GO | suspend token/restart denied + Live Now remove | - |
| 11 Reminders/prefs | GO | prefs GO; reminders flag ON; claim RPC | due-window email delivery rate-limited |
| 12 10 locale | GO_STATIC | i18n parity PASS | Electron UI visual not run |
| 13 LiveKit/Go Live | GO_PARTIAL | edge tokens + WS two-client + Go Live start | Headless media tracks not published |
| 14 Feature rollout | GO | apps/review/badges/prefs/discovery/golive/reminders ON | - |
| 15 Monitoring/rollback | GO_DOCS | rollback runbook present | PITR unverified |
| 16 Phase1 final | PARTIAL | external runtime sealed | Media tracks headless pending |
| 17-23 Phase2/3 | BLOCKED | - | provider/legal/recording |
| 24 Full readiness | PARTIAL | Phase1 partial media | Phase2/3 blocked |
| 25 External runtime | GO_PARTIAL | LiveKit/SMTP/workers wired | Media tracks + inbox assert |

## Feature flags (production client-config)
- enablePublisherApplication: ON
- enablePublisherReview: ON
- enablePublisherBadgeDisplay: ON
- enableLiveNowDiscovery: ON
- enableGoLive: ON
- enablePublisherReminders: ON
- enablePublisherNotificationPreferences: ON

## External runtime
- LiveKit: wss://voice.picom.gg (self-hosted VPS) GO
- Auth SMTP: mail.spacemail.com verify@picom.gg GO
- Workers: email + event-reminder on production GO
- Evidence: docs/audit/evidence/live-now-publisher-external-runtime-20260803T222116Z/

## Verdict
PICOM MASTER EXECUTION CONTROL: GO (tracking)
PICOM PRODUCTION LIVEKIT: GO
PICOM LIVEKIT TOKEN GATES: GO
PICOM LIVEKIT TWO-CLIENT RUNTIME: PARTIAL_SIGNALING_GO_MEDIA_HEADLESS
PICOM PRODUCTION SMTP: GO
PICOM SMTP DELIVERY: PARTIAL_PROVIDER_ACCEPT_RATE_LIMITED
PICOM PRODUCTION WORKERS: GO
PICOM PUBLISHER REMINDERS: GO
PICOM LIVE NOW DISCOVERY: ON
PICOM PUBLISHER GO LIVE: ON
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL_MEDIA_TRACKS_PENDING
