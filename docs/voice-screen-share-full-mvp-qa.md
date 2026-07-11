# Voice and Screen Share Full MVP QA

Status date: 2026-07-11
Local contract result: **PASS**
Hosted/provider/native media result: **BLOCKED**

This report separates deterministic repository evidence from real provider and native-platform evidence. A structural smoke pass is not reported as proof of audio transport, remote screen rendering, operating-system permission behavior, or packaged-client interoperability.

## Local acceptance matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Token request and least privilege | JWT, member/type configuration, visitor/private/ban/timeout, scoped grants, short TTL, source grants, restricted CORS, secret boundary | PASS |
| Two-client architecture | Stable room naming, participant events, disconnect cleanup, duplicate join guard | PASS (contract only) |
| Audio, mute, deafen, speaking | LiveKit microphone controls, subscriptions, active-speaker events, safe error states | PASS (contract only) |
| Devices | Permission-gated enumeration, input/output selection, device removal fallback, no recording | PASS |
| Reconnect | Bounded backoff, coalescing, cancellation, sleep/wake recovery, mute/deafen preservation | PASS |
| Connected Voice | Production voice snapshot, participant count, room context, mute/deafen/leave integration | PASS |
| Source picker | Focused explicit action, bounded source descriptors, unpredictable session ID, select/cancel invalidation, narrow preload bridge | PASS |
| Full screen/window selection | Screen/window source ID validation and explicit user selection | PASS (contract only) |
| Publish and remote view | Screen-scoped token upgrade, publish/unpublish, remote track subscription/render state | PASS (contract only) |
| Stop/cancel/deny/retry | Stop, OS-ended track, cancel, permission guidance, alert and retry states | PASS |
| Cleanup | Track stop/unpublish, participant disconnect cleanup, listener cleanup, window-close leave | PASS |
| Role access | `joinVoice`, `speak`, `shareScreen`, mute/remove/manage hierarchy, type configuration, private denial | PASS (structural DB/Edge contract) |
| Electron security | Context isolation, disabled Node integration, sandbox, whitelisted preload IPC, renderer native boundary | PASS |
| Radio separation | Radio broadcast permissions do not imply normal voice-room grants | PASS |

## Commands and results

All commands below exited with code 0 unless explicitly marked BLOCKED:

```text
npm run livekit:smoke
npm run livekit:token:security:smoke
npm run voice:client:smoke
npm run voice:devices:test
npm run voice:settings:smoke
npm run voice:recovery:test
npm run voice:reconnect:full-mvp:smoke
npm run voice:mini-card:test
npm run voice:discovery:test
npm run voice:quality:test
npm run screen-share:bridge:full-mvp:smoke
npm run screen-share:publish:full-mvp:smoke
npm run screen-share:recovery:test
npm run screen-share:preview:test
npm run screen-share:quality:test
npm run electron:security:smoke
npm run renderer:native:smoke
node scripts/smoke-voice-screen-permissions.mjs
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
```

`npm run livekit:token:staging` completed its safe preflight and reported **BLOCKED** because `--run` and the required staging-only variables were absent. It made no network request and printed no values.

## Corrected QA gap

The token security smoke previously inspected the Task 501 Text-only migration, so it could pass without checking the current Task 506 type configuration. It now checks the latest authorization migration for:

- `voiceRoomsEnabled` server enforcement;
- Text, Radio, and Podcast read boundaries;
- canonical `speak` and screen grants;
- explicit separation from Radio host/listener permissions;
- microphone and screen capability fields returned to the renderer.

No product behavior changed in this QA task.

## Hosted and native blocked matrix

| Required real scenario | Result | Missing evidence |
| --- | --- | --- |
| Deployed token function and real allowed/denied accounts | BLOCKED | Hosted Supabase project variables and deployed Task 506 migration/functions |
| Two independent LiveKit clients joining one room | BLOCKED | Hosted LiveKit project, protected credentials, two synthetic accounts/clients |
| Bidirectional microphone audio and speaking indicators | BLOCKED | Real media devices and two connected clients |
| Mute/deafen propagation and moderator mute/remove | BLOCKED | Hosted room with lower/higher role participants |
| Network interruption and ghost-participant cleanup | BLOCKED | Controllable real network and two hosted clients |
| Connected Voice card against a hosted room | BLOCKED | Real connected session |
| Screen/window source capture and remote rendering | BLOCKED | Two real clients and explicit native capture |
| Permission deny, retry, stop, leave, restart | BLOCKED | Native OS permission manipulation and packaged candidates |
| Windows packaged certification | BLOCKED | Packaged two-client execution and recorded evidence |
| Linux X11/Wayland/PipeWire certification | BLOCKED | Native Linux host and packaged candidate |
| macOS Screen Recording certification | BLOCKED | Signed/notarized macOS candidate and native host |

## Manual execution required

Follow `docs/voice-screen-share-qa.md`, `docs/hosted-livekit-two-client-validation.md`, and `docs/cross-platform-screen-share-evidence-closure.md`. Record only redacted results: platform/version, architecture, pass/fail, timestamps, and defect identifiers. Never record tokens, private room identifiers, screen content, device IDs, credentials, or captured audio.

## Remaining risks

- Hosted Task 506 migration and both LiveKit Edge Functions have not been deployed or exercised in this environment.
- No real audio packet or screen frame crossed between two clients.
- Native packaged behavior remains uncertified on Windows, Linux, and macOS.
- The existing bundle-size/dynamic-import warnings remain separate release work and did not fail this task's quality gates.

Release recommendation for provider/native voice and screen-share certification: **BLOCKED / No-Go until the hosted and platform matrices are executed.**
