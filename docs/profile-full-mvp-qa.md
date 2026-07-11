# Profile Full MVP QA

## Scope

This QA pass covers current/other, verified/unverified, blocked, public/private, and empty-media profile variants across editing, privacy, relationships, verification, media, activity, audio, and source navigation.

## Automated local matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Canonical profile domain | `profile:domain:smoke` | PASS locally |
| Avatar/cover edit, validation, retry/remove | `profile:edit-storage:smoke` | PASS locally |
| Full sections, empty/loading/error states | `profile:sections:smoke` | PASS locally |
| Follow/friend/DM/block/report/verification actions | `profile:relationships:smoke` | PASS locally |
| Privacy projection and 26-case role/user matrix | `profile:access:smoke`, `supabase:rls:smoke` | PASS structurally |
| Activity/media service | `profile:activity:supabase:smoke` | PASS structurally |
| Hosted Radio/Podcast/saved audio | `audio:profile:smoke` | PASS locally |
| Verified/unverified rendering | `verification:badges:smoke` | PASS locally |
| Feed/DM/Chat regression | `mock:smoke`, `qa:smoke`, build | PASS locally |
| Light/dark desktop visual variants | `visual:regression:contract` | PASS contract; pixel capture BLOCKED |
| Profile UI core flow | `e2e:coverage:contract` | PASS contract; UI runner BLOCKED |
| Hosted RLS execution | `supabase:rls:test` | BLOCKED: Supabase CLI/staging unavailable |

## Acceptance-path checks

- Current profile exposes Edit and verification request/status, not relationship actions.
- Other profiles expose state-aware Follow, Message, Friend, Block/Unblock, Report, and More actions.
- Avatar/cover updates validate content and ownership, show progress, retry safely, and roll back failed persistence.
- Shared images use ImagePreview; Radio/Podcast use existing player/detail systems.
- Activity switches to its source community/channel and highlights the source message when available.
- Blocked/private/inaccessible source content is omitted server-side and mirrored by UI states.
- Supabase mode does not present mock zero stats as loaded production evidence.

## Visual and E2E honesty

The repository still has no activated Playwright/Electron pixel or interaction runner and no approved cross-platform screenshot baselines. The manifests remain `contract_only`/`planned`; this pass expands deterministic coverage definitions but does not fabricate live UI execution. Manual Windows/Linux/macOS exploratory execution remains a release-candidate activity.

## Remaining evidence

- Execute `npm run supabase:rls:test` against an isolated local/staging Supabase database.
- Capture approved Windows/Linux/macOS light/dark profile baselines after the UI runner is activated.
- Exercise real Storage upload, multi-client profile refresh, and deep links against staging credentials.
