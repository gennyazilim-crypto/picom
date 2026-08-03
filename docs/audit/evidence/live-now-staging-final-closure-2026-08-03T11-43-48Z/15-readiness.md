# PICOM Live Now Staging Final Product Closure — Readiness

Evidence dir: `docs/audit/evidence/live-now-staging-final-closure-2026-08-03T11-43-48Z/`  
Project ref: `ufmtvqtsklqsmqxefbbs` (staging only; no production ops)  
UTC stamp: `2026-08-03T11-43-48Z`

## Scope

Closed remaining product gaps after Case 04 / Case 18 / JWT-RLS / realtime revocation (already GO; not re-opened).

## Command matrix

| Gate | Exit | Log |
|------|------|-----|
| supabase db push (`20260803172000_…`) | 0 | `01-migration-push.log` |
| npm run typecheck | 0 | `02-typecheck.log` |
| Live Now i18n 10-locale parity | 0 (4/4) | `03-i18n-parity.log` |
| Live Now unit/component tests | 0 (61/61) | `04-live-now-unit-tests.log` |
| npm run build | 0 | `05-npm-build.log` |
| npx vite build | 0 | `06-vite-build.log` |
| npm run desktop:smoke | 0 | `07-desktop-smoke.log` |
| Reminder integration (hosted) | 0 (9/9) | `08-reminder-integration.log` |
| Notification pref integration (hosted) | 0 (9/9) | `09-notif-pref-integration.log` |
| Staging UI/API smoke | 0 (14/14) | `10-staging-ui-smoke.log` |
| npm run secrets:smoke | 0 | `11-secrets-smoke.log` |
| Evidence secret scan | PASS | `12-evidence-secret-scan.log` / `secret-scan.txt` |
| npm run lint | NOT_CONFIGURED | no `lint` script in package.json |

## Deliverables closed

### I18N
- Canonical 10 locales in `liveNowCatalog.ts` (en,tr,de,fr,es,it,pt,ru,ar,ja)
- CTA + notify mode + remind keys present; `translateLiveNow` throws on missing locale/key
- Parity test PASS

### Reminders
- Table `publisher_stream_schedule_reminders` unique `(user_id, schedule_id)`
- RPCs: set / list / claim; schedule update/cancel trigger sync
- Worker claims publisher reminders + idempotent email enqueue
- LiveWorkspace toast stub removed; backend toggle wired

### Notification preferences
- Modes: `all_live` | `scheduled_only` | `important_only` | `off`
- Backend `upsert_live_broadcaster_notification_pref` + fanout normalize
- No LocalStorage for prefs

### Typecheck
- `npm run typecheck` EXIT 0
- `voiceService` Uint8Array copy path intact (no `as any` / `@ts-ignore`)

### Staging UI smoke
- threshold / pending / approved_active / suspended
- Live Now list empty ok + loading/error UI wiring
- follow + notification preference
- scheduled reminder enable
- Web route map + desktop smoke

## LINT
**LINT: NOT_CONFIGURED** (package.json has no lint script; do not treat as source FAIL)

## Monetization / Production
- Monetization remains BLOCKED
- Production remains PENDING (staging-only evidence)

## Prior GO carry-forward (not re-run)
- Case 04 / Case 18 SQL
- JWT/RLS + realtime badge revocation
