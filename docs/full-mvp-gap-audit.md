# Picom Full MVP Gap Audit

Audit date: 2026-07-11
Source baseline: `a3a855d4dfdea8a7a004ffb584936325a2cdc7f5`
Latest required QA: [Picom QA #541](https://github.com/gennyazilim-crypto/picom/actions/runs/29130390770), successful

## Status vocabulary

- **Complete**: implementation and required deterministic contracts are present for current scope.
- **Partial**: meaningful implementation exists but required Full MVP behavior is incomplete.
- **Placeholder**: visible or callable surface deliberately lacks final behavior.
- **Broken**: current behavior or contract is known to fail.
- **Mock-only**: functional local implementation without production data integration.
- **Supabase-ready**: service/schema boundary exists but hosted proof may be incomplete.
- **Hosted-verified**: executed against an approved hosted environment with archived evidence.
- **Blocked**: completion requires unavailable external/native/approval evidence.

## Feature audit

| Area | Status | Current evidence | Full MVP gap / next task range |
| --- | --- | --- | --- |
| Electron shell/security | Partial, code-complete foundation | Frameless BrowserWindow; menu disabled; validated IPC; persisted state; `contextIsolation`, sandbox, and no node integration | Live functional controls and frame/state QA in 433-434 |
| Text community chat | Partial / Supabase-ready | Existing community, channel, message, permission, invite, moderation, and realtime services | Preserve while introducing kind-aware domain in 435-444 and final integration in 510 |
| Community kind domain | Missing | No `CommunityKind`, `communityKind`, or `community_kind` source/schema match | Add append-only domain/migration/backfill/templates/routing/RLS in 435-444 |
| Radio | Partial / mock and Supabase adapter | `RadioPanel`, `radioService`, shared `audioDataSource`, audio migration, radio smoke scripts | Not a first-class community kind; host/producer/schedule/role/moderation/hosted flows incomplete; 445-452 |
| Podcast | Partial / mock and Supabase adapter | `PodcastEpisodeDetail`, `podcastService`, shared audio data source/migration, podcast smoke | Not a first-class community kind; publishing/queue/resume/reactions/comments/permissions/search/hosted flows incomplete; 453-459 |
| Friends | Partial / Supabase-ready | Friends view/types/mock data, friend-request migration and production smoke | Service/realtime/notification/privacy/presence integration and hosted RLS matrix incomplete; 460-462 |
| Direct Messages | Partial / functional / Supabase-ready | Desktop DM UI, mock store, facade services, Supabase service, realtime hook/service, several DM migrations and RLS smoke | Historical schema overlap; full interactions, read states, privacy/block/report and hosted participant isolation incomplete; 463-469 |
| Verified identity | Complete visual contract; backend hosted proof partial | Canonical approved-only `VerificationSummary`, application-wide UI integration, admin/RLS migrations | Task 468 should validate cross-feature data integration without reintroducing booleans; hosted review policies remain part of 517 |
| Full Profile | Partial / functional / Supabase-ready | Full ProfileView, privacy/profile/activity services and migrations, audio sections, verification integration | Real edit/avatar/cover storage, complete stats/activity/media, access/privacy hosted proof incomplete; 470-475 |
| Mention Feed/stories | Partial / functional / mixed source | Mention feed cards/footer/tabs/stories/right rail, ranking/service, Supabase feed/story migrations and smokes | One canonical text/radio/podcast mention model, pagination, actions, realtime/cache, deep-link and hosted evidence incomplete; 476-483 |
| Settings | Partial | Large SettingsModal, settings service, diagnostics and completeness tests | Account/Profile/Notifications/Voice/Advanced sections still contain explicit placeholder/coming-soon paths; persistence and section contracts complete in 484-491 |
| Community Admin | Partial / functional | Role assignment, channel/category management, audit, ownership transfer, moderation, settings and safety surfaces | Kind-aware roles/sections, hierarchy safeguards, visitor/private settings, reports, danger zone and full QA incomplete; 492-500 |
| Voice | Partial / local-contract ready | LiveKit and room/device/reconnect/discovery services, VoiceRoomView, token Edge Function source, smoke tests | Protected deployment, real devices/two-client media, access/moderation and hosted evidence incomplete; 501-503, 506-507 |
| Screen Share | Partial / Electron bridge ready | Capture service, picker, preview, controls, viewer, quality/recovery tests, desktopCapturer IPC | Real publish/remote render/cleanup and native Windows/Linux/macOS certification incomplete; 504-507; external evidence blocked where unavailable |
| Supabase Auth/onboarding | Partial / hosted core evidence | Auth/profile triggers, onboarding/profile schema, client/data-source infrastructure; prior hosted migration/Auth evidence | Production flow cleanup and complete account matrix in 508-509 |
| Supabase database/RLS | Partial / extensive schema | Large append-only migration set and RLS smokes; prior hosted core role/private Storage evidence | Community kind, audio, friendship, DM, profile, feed, voice and complete role/content matrix in 508-517 |
| Supabase Storage | Partial / Supabase-ready | Private attachment/storage policy and review scripts | Historical signed-URL refresh, avatar/cover/audio lifecycle, lost-access denial and hosted matrix incomplete; 514 and 517 |
| Supabase Realtime | Partial / local-contract ready | Presence/topic authorization migrations, message/DM services, dedupe/backpressure/order tests | Hosted private Presence previously unauthorized; full cleanup/unread/friend/audio matrix incomplete; 515 and 519 |
| Edge Functions | Partial / source-ready | `livekit-token` plus release/support function sources and deployment contracts | Release-scoped functions not fully deployed/hosted-validated; JWT/CORS/secrets matrix in 516 and 519 |
| Mock mode | Complete for current baseline | `dataSourceService` and feature-specific mock branches; mock smoke green | Keep parity through 518, then constrain duplicate paths without removing required offline development behavior |
| QA/build | Complete deterministic baseline | Latest GitHub required QA green; typecheck, mock, build, QA, contract, performance gates established | Add feature-specific contracts as tasks land; hosted/native evidence remains separate |
| Stable release | Blocked / NO-GO | `docs/release-blockers.md` RB-01 through RB-11 remain open | No stable publication before 519-520 and separate release evidence closure |

## Duplicate and conflict audit

### Verification

- UI conflict fixed in commit `a3a855d`: DM boolean removed and canonical approved-only summary established.
- Backend retains both legacy `verification_badges` and newer profile/community verification request tables. These are distinct review/audit layers today but Task 468/517 must document the authoritative projection and prevent conflicting public state.
- Do not reintroduce `isVerified`, `verified`, DM-only booleans, or role-derived verification.

### Community models

- The current `Community` model has no first-class kind. Radio and Podcast are audio records keyed to ordinary communities.
- Task 435 is the sole domain introduction point. Later tasks must consume that model rather than add per-feature booleans such as `isRadioCommunity`.

### Audio services

- `radioService` and `podcastService` correctly sit above a shared `audioDataSource` and should remain feature facades.
- New work must extend these layers and the existing audio migration, not create component-local Supabase calls or a second catalog store.

### Direct Messages

- `src/services/directMessages/*` is the application facade; `src/services/supabase/directMessageService.ts` is the provider adapter. Similar names are intentional layering, not permission to bypass the facade.
- Multiple historical DM migrations (`002900`, `003000`, `187000`, `248000`) overlap. Task 463 must add a safe superseding migration and contract audit rather than edit deployed migration history.

### Permissions

- `communityPermissions.ts` is the central UI/domain permission helper.
- Private-channel, role-assignment, moderation, and ownership services add operation-specific checks but must delegate shared role/access semantics to the central helper and RLS.
- Community-kind permissions belong in the existing access model, not separate Radio/Podcast frontend-only gates.

### Feed and profile data

- Mention Feed, stories, audio feed cards, profile activity, and audio profile sections currently join data in several feature services.
- Tasks 476-483 define the unified mention projection; Tasks 470-475 define the profile projection. Components must not become competing stores.

## Exact task dependencies

| Range | Required predecessor | Output dependency |
| --- | --- | --- |
| 432 | 431 | Safe clean-worktree and staging policy for all later tasks |
| 433-434 | 432 | Verified Electron controls/state for 504 native bridge and final QA |
| 435-436 | 432 | Community kind type, migration, and safe text backfill |
| 437 | 435-436 | Kind-aware creation input |
| 438-440 | 437 | Text, Radio, Podcast templates |
| 441-443 | 438-440 | Routing, permissions/RLS, invite/join/onboarding |
| 444 | 435-443 | Community-kind integration gate |
| 445-452 | 444 | Radio data through E2E |
| 453-459 | 444 | Podcast data through E2E |
| 460-462 | 432 | Friendship schema, service/realtime, UI |
| 463-467 | 460-462 | DM schema, service/realtime, UX, interactions, safety |
| 468-469 | 463-467 and current verified contract | Cross-Picom identity consistency and Friends/DM QA |
| 470-475 | 460-469 | Profile schema/edit/sections/actions/privacy/E2E |
| 476-483 | 452, 459, 469, 475 | Unified feed model through E2E |
| 484-491 | 475 and 483 | Settings persistence and all section QA |
| 492-500 | 444 | Mature kind-aware community administration |
| 501-503 | 434 and 500 | Protected token, voice client, devices/reconnect |
| 504-507 | 434 and 501-503 | Electron share bridge, media lifecycle, permissions, E2E |
| 508 | 444, 452, 459, 469, 475, 483, 491, 500, 507 | Supabase environment/types/migration baseline cleanup |
| 509-517 | 508 in numeric order | Production Auth, product data, Storage, Realtime, Edge, RLS matrix |
| 518 | 509-517 | Mock/Supabase source convergence |
| 519 | 518 plus protected hosted environment | Full staging matrix; may be BLOCKED without credentials/providers |
| 520 | 519 | Final factual audit and release-readiness decision |

## Current blockers

Canonical release blockers RB-01 through RB-11 remain open. Most relevant to this pack are hosted RLS/Storage/Realtime/Edge evidence, hosted LiveKit, native screen share, native packages/signing, production ownership, legal approval, and compatible restore validation. Missing external evidence remains `BLOCKED`; it is not converted into local PASS.

