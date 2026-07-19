# Feed, DM and Community production audit

Date: 2026-07-19

## Executive result

The repository already contains substantial Supabase, RLS, Realtime, pagination, attachment and role infrastructure. The audit did not justify a rewrite. One build-blocking DM call contract defect and one production/mock bundling boundary were corrected in this pass.

Production release status remains **No-Go** until hosted RLS, two-user Realtime, large-data, LiveKit/network and packaged Windows evidence is recorded. Local source contracts are not a substitute for hosted acceptance evidence.

## Priority register

| Priority | Problem | Screen/system | Source evidence | Root cause | Action | Verification/dependency |
| --- | --- | --- | --- | --- | --- | --- |
| P0 fixed | TypeScript could not build the renderer | DM voice call | `src/App.tsx`, `src/components/directMessages/DmCallInformation.tsx` | Optional camera state was used as required boolean, the invite hook API name was stale, and an effect cleanup returned `boolean` | Normalize camera state, call `cancelOutgoing`, wrap subscription cleanup | `npm run typecheck`, build |
| P0 open | Hosted schema/RLS state is not proven by this checkout | Feed, DM, Community | Supabase migrations exist, but no hosted run was executed in this pass | Source migration presence does not prove deployment or policy behavior | Run protected hosted RLS suite with two isolated users | Staging credentials and approved test project |
| P1 fixed | Production Feed modules eagerly imported mock datasets | Feed startup/bundle | `feedQueryService.ts`, `mentionFeedService.ts` | Static imports crossed the mock/production boundary | Load mock datasets only inside the mock branch | Build and performance budget |
| P1 open | Offline mutation queue is volatile and community-message-only | Community composer, DM actions, Feed actions | `messageSendQueueService.ts`, `offlineSyncConflictService.ts` | Queue promises and pending IDs live only in memory; DM/Feed mutations have no durable replay journal | Add encrypted/user-scoped IndexedDB mutation journal, retry policy and conflict UI | Offline/restart integration tests |
| P1 open | Feed page navigation is not wired through the visible list | Mention Feed | RPC/service cursor support exists; UI requests a fixed first page | Service pagination and UI pagination are separate implementations | Add guarded next-page loading and windowed rendering | 1k/10k item dataset |
| P1 open | Hosted multi-user behavior is not evidenced | DM, Feed, Community | Local smoke contracts only | Realtime and RLS require two real sessions | Execute acceptance matrix in `multi-user-acceptance.md` | Two staging accounts/windows |
| P2 | Feed invalidates the full query cache for broad table changes | Mention Feed Realtime | `feedRealtimeService.ts` and App invalidation path | Coarse invalidation is safe but can refetch too often at scale | Introduce source/user scoped invalidation after hosted profiling | Realtime load trace |
| P2 | DM reaction/attachment routing preloads only the latest 500 message IDs | Long DM history | `directRealtimeService.ts` | Child rows do not contain conversation ID, so routing uses a bounded ID set | Extend event projection or register IDs as pages load | Long-history two-user test |
| P2 | Separate feature services own their own Supabase channels | Global Realtime lifecycle | Feed, DM, saved messages and community hooks | Channel naming is centralized, lifecycle ownership is not | Add a lease/ref-count registry only after contract tests cover all consumers | StrictMode/reconnect soak |
| P2 | Cross-platform renderer and native behavior is not currently certified | Windows/Linux/macOS | No current package evidence in this pass | One Windows development checkout cannot certify three platforms | Run native package matrix | Native runners/signing context |
| P3 | Accessibility and performance results need a fresh post-change baseline | All three workspaces | Existing scripts are available | Evidence can drift after feature work | Run local contracts and protected CI | Build artifacts |
| P4 | Ranking weights, cache TTLs and Realtime debounce need production telemetry | Feed | Static values in Feed services | No privacy-safe production telemetry baseline | Tune only after anonymized metrics | Operations approval |

## Data model conclusion

- Feed: canonical Supabase RPCs and mention projection exist; public/private visibility must remain RLS-backed.
- DM: direct conversations, participants, messages, reactions, attachments, read cursors and idempotent send RPCs exist.
- Community: owner/founder invariants, member roles, public join and visibility migrations exist.
- Profile media: the central avatar/cover resolver and private Storage path model are the approved identity-media path.

## Do not merge as complete without

1. Hosted RLS negative tests.
2. Two-user insert/update/delete/read/presence tests.
3. Offline restart recovery tests after a durable mutation journal exists.
4. Large dataset pagination and memory measurements.
5. Packaged Windows smoke plus Linux/macOS native evidence when those platforms are in the release target.
