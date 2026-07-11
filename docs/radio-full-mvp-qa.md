# Radio Full MVP QA

## Scope

This gate verifies the complete local and Supabase-ready Radio acceptance path: Radio community creation defaults, roles, schedules, host/producer controls, listening, mini player, reactions, saves, reminders, Feed/Profile integration, moderation, visibility, realtime/reconnect contracts, and ended/cancelled states.

## Local automated matrix

| Area | Evidence |
| --- | --- |
| Community creation | `community:radio-template:smoke` |
| Domain and lifecycle | `audio:domain:smoke`, `radio:data-model:smoke` |
| Listener and mini player | `audio:player:smoke`, `radio:listener-player:smoke` |
| Scheduling and notifications | `radio:scheduling-notifications:smoke` |
| Feed, Profile, search, deep links | `audio:feed:smoke`, `audio:profile:smoke`, `radio:cross-surface:smoke` |
| Host, producer, roles, moderation | `radio:host-producer:smoke`, `radio:roles-moderation-audit:smoke` |
| Realtime and reconnect contract | `radio:service-realtime:smoke` |
| RLS and service boundary | `audio:schema:smoke`, `audio:service:smoke`, `supabase:smoke` |
| Visual and core flows | `visual:regression:contract`, `e2e:coverage:contract` |
| Regression | `mock:smoke`, `qa:smoke`, production build, performance budget |

`radio:full-mvp:qa` also fails if active Radio acceptance components contain raw placeholder/console-only actions, mock audio references external streams, or distributable asset roots contain unreviewed audio files.

## Access and privacy

- Local Radio Feed/search visibility requires community membership or public-content access.
- Supabase mode relies on Radio/Podcast RLS for sessions, reactions, listeners, saved items, reminders, and read state.
- Draft/cancelled sessions are excluded from public Feed/search; cancelled lifecycle behavior remains covered in the Radio model tests.
- A deep link or notification identifier never grants access by itself.

## External evidence

The following cannot be certified by repository-only tests and must remain **BLOCKED**, not passed, until a configured staging environment is available:

- two authenticated Supabase clients observing the same Radio session in realtime;
- network disconnect/reconnect against hosted Realtime;
- provider audio transport under real latency and device conditions;
- staging RLS execution with seeded public/private member and visitor accounts.

Run those checks through the protected hosted-validation workflow with non-production fixtures and record its immutable run URL before release promotion.

## Task 452 results

- PASS: consolidated Radio Full MVP QA and all 19 feature/coverage sub-gates.
- PASS: TypeScript, mock mode, Supabase structural/API/RLS contracts, production build, general QA smoke, license notices, and generated dependency license report.
- PASS: no external mock stream URL and no distributable audio file was found.
- PASS: renderer hard caps; initial JS 1495.9 KiB, initial CSS 225.4 KiB, total assets 2903.6 KiB.
- FIXED: added a cancelled-session fixture so ended and cancelled lifecycle states are both exercised.
- FIXED: updated stale Feed/Profile smoke assertions to the current shared reminder and RLS-backed service architecture.
- BLOCKED: Supabase CLI pgTAP execution and hosted two-client Realtime/reconnect evidence.
- BLOCKED: real pixel screenshot and Electron UI E2E execution; the current visual and E2E coverage contracts passed but explicitly do not claim runner execution.
- BLOCKED: native audio-device/provider validation on Windows, Linux, and macOS.

## Manual desktop matrix

At 1440x900 in light and dark themes, create/switch to a Radio community; schedule, start, join, react, save, and end a session; confirm reminder routing, Feed/Profile source opening, moderator controls, public visitor visibility, private denial, reconnect state, and Text/Podcast regression. Windows, Linux, and macOS native audio-device evidence remains platform-specific release evidence.
