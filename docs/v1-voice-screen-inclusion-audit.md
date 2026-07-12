# Picom V1 Voice and Screen Share Inclusion Audit

Status date: 2026-07-12  
Decision: **BLOCKED - remain HIDDEN_FROM_V1**

This audit reopens the evidence question without changing product source or claiming provider/native success. Picom has a substantial dormant Voice and Screen Share implementation, but the evidence required to ship both capabilities in Windows-first V1 is incomplete.

## Executive finding

Task 621 made the correct fail-closed decision. Local code and deterministic contracts demonstrate an architecture, not a production media service. No immutable evidence in this checkout proves a selected production LiveKit project, region, plan/capacity, protected credential custody, deployed authorization stack, two real clients exchanging bidirectional audio, or the exact packaged Windows candidate selecting and remotely rendering a shared screen.

Therefore:

- `voiceRooms` remains `HIDDEN_FROM_V1`.
- `screenShare` remains `HIDDEN_FROM_V1`.
- No V1 navigation, release copy, onboarding, help, settings promise, channel entry, deep link, Feed control, or deployment manifest may expose either feature.
- Tasks 643-653 may prepare and collect evidence, but Task 654 is the only allowed reclassification point.
- Missing hosted, credential, provider, or native evidence is `BLOCKED`, never `PASS`.

## Sources inspected

- Task 621 checkpoint and V1 decision documents.
- `src/config/v1ReleaseScope.ts` and renderer routing/gates.
- Community channel filtering, Feed Connected Voice controls, Settings, VoiceRoomView, Noise Shield, and diagnostics.
- `voiceService`, reconnect recovery, LiveKit wrappers, screen capture services, picker/controls/viewer.
- Electron main/preload IPC, payload validation, renderer type bridge, and package configuration.
- `livekit-token` Edge Function plus voice/screen authorization migrations.
- LiveKit dependency and voice/screen smoke inventory.
- Existing hosted/native certification documents.
- Environment/configuration names only. No value was printed or copied.

## Current implementation inventory

| Surface | Repository state | Classification | Production evidence |
| --- | --- | --- | --- |
| Voice channel routing | Voice channel renderer and room view exist; central V1 channel filtering prevents entry | Real implementation, V1-hidden | BLOCKED |
| VoiceRoomView | Join/leave, mute/deafen, participants, speaking, screen controls and error states are wired through service boundaries | Real/partial | Local contract only |
| `voiceService` | Uses `livekit-client@2.20.0`; room events, tracks, participant state and cleanup paths exist | Real/partial | No hosted two-client media proof |
| Token client wrapper | Calls protected Supabase Function and validates typed response | Real/partial | Hosted deployment unverified |
| `livekit-token` Edge Function | Authenticates caller, derives scoped room/grants, reads server-only provider credentials | Real/partial | Deployment and real allow/deny matrix unverified |
| Voice permissions | SQL functions enforce active membership, channel/community type settings, bans/timeouts, role permissions and scoped grants | Real/partial | Migration presence only; hosted application unverified |
| Connected Voice rail | Uses production voice snapshot and controls; returns null while V1 Voice gate is disabled | Real, V1-hidden | No connected hosted session proof |
| Voice & Audio settings | Device/settings foundations exist behind V1 scope policy | Real/partial, V1-hidden | Packaged device behavior unverified |
| Noise Shield | Standard/enhanced processing controls and diagnostics exist | Partial/provider-dependent, V1-hidden | Enhanced runtime/provider certification absent |
| Screen source picker | Electron `desktopCapturer` main-process path, narrow preload bridge and bounded source DTOs exist | Real/partial | Packaged Windows interaction unverified |
| Screen publication | LiveKit screen-track publish/unpublish and remote render state paths exist | Real/partial | No remote frame between real clients |
| Screen cleanup | Stop/cancel/OS-ended/leave cleanup contracts exist | Real/partial | Native and hosted execution unverified |
| Diagnostics | Redacted voice/meeting diagnostics registries exist | Real/partial | No production telemetry evidence |
| Meeting workspace | Broader meeting/camera/stage code exists | Post-V1 and out of this inclusion path | Not a prerequisite for Voice Rooms V1 |
| Mock fixtures | Mock voice/meeting data and structural smoke fixtures exist | Mock/test only | Never release evidence |

## Hidden gate inventory

| Gate location | Current behavior |
| --- | --- |
| `src/config/v1ReleaseScope.ts` | Canonical `voiceRooms` and `screenShare` flags are disabled and classified `HIDDEN_FROM_V1`. |
| `src/App.tsx` | Visible channels are filtered through the V1 channel gate; inaccessible voice channels cannot resolve as active. Voice services remain dormant source. |
| `src/components/CommunitySidebar.tsx` | Filters category channels using `isV1ChannelTypeEnabled`. |
| `src/components/FeedCompanionRail.tsx` | Connected Voice card returns no UI while the Voice V1 feature is disabled. |
| Settings navigation/UI policy | Voice & Video/voice controls are not exposed as a V1 promise. |
| Community Admin settings | Voice-room configuration is retained but excluded from V1-visible controls. |
| First Launch/onboarding | No microphone, Voice, or Screen Share promise is made. |
| Help/release copy | V1 documents describe Voice and Screen Share as absent. |
| Deep-link and active-view resolution | Voice/meeting destinations cannot bypass the V1 scope registry. |
| Edge release manifest/deployment scripts | LiveKit token/moderation/webhook functions are not part of the V1 deployment set. |
| Client/remote config | Voice and Screen Share remain false/fail-closed for V1. |
| Release blockers and Go/No-Go | RB-04/RB-05 are closed by scope only, not certified as operational. |

A later implementation task must update every gate atomically. Enabling only a UI entry point or only a remote flag is forbidden.

## Provider, environment, and secret custody

| Item | Required production fact | Evidence now | Status |
| --- | --- | --- | --- |
| Provider model | Explicit LiveKit Cloud or reviewed self-hosted selection | Runbook compares both; no approved selection record | BLOCKED |
| Project/environment | Dedicated production and staging projects | No linked/approved project evidence in the clean audit checkout | BLOCKED |
| Region/data residency | Selected region(s) and legal/latency rationale | Not recorded | BLOCKED |
| Public URL | Approved `wss://` endpoint associated with selected project | No value inspected; no immutable verification | BLOCKED |
| API key/secret | Protected Edge Function secret custody with named owner and rotation | Names and correct server boundary exist; custody/owner unverified | BLOCKED |
| Plan/capacity | Participant, room, bandwidth/egress, TURN and support limits | Not recorded or load-validated | BLOCKED |
| Monitoring/quota | Provider alarms, quota threshold and incident owner | Not evidenced | BLOCKED |
| Renderer config | `VITE_LIVEKIT_ENABLED`, optional public `VITE_LIVEKIT_URL` only | Names documented; current process has neither set | BLOCKED |
| Edge secrets | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Names documented; current process has none set | BLOCKED |
| Supabase deployment authority | Project ref/access token held outside renderer | Names documented; current process has none set | BLOCKED |

A local `.env.local` exists in the primary working copy, but this audit did not inspect or print its values. File presence is not provider, deployment, custody, or release evidence.

## Authorization and token assessment

Positive local findings:

- Provider API secret names are confined to Edge/server code and docs; renderer/preload receive no provider secret.
- The token function requires an authenticated Supabase session.
- Room identity is derived from community/channel context rather than accepting an arbitrary room.
- SQL authorization covers membership, visibility, bans, timeouts, community type configuration, role permissions and moderation hierarchy.
- Token grants are scoped to one room and capability set.
- The Electron renderer uses a narrow context-isolated preload API for native capture.

Open risks:

- Hosted migrations/functions may differ from the repository or may not be deployed.
- Real visitor/member/private/ban/timeout/role allow-deny responses are unrecorded.
- Token expiry/refresh behavior has no immutable hosted run.
- Provider room and participant quotas are unknown.
- Abuse response, moderation propagation and rate limits are not proven against the real service.
- No evidence proves logs exclude bearer tokens, provider credentials, device identifiers and room-sensitive metadata in production.

## Voice evidence matrix

| Required evidence | Local status | Release status |
| --- | --- | --- |
| Secure token boundary and scoped claims | PASS_LOCAL | Hosted verification required |
| Authorized/unauthorized role matrix | PASS_STRUCTURAL | BLOCKED_HOSTED |
| Two independent real clients join one room | Not executed | BLOCKED_HOSTED |
| Bidirectional microphone audio | Not executed | BLOCKED_HOSTED/NATIVE |
| Mute state and deafen behavior | PASS_STRUCTURAL | BLOCKED_HOSTED/NATIVE |
| Speaking indicators and participant list | PASS_STRUCTURAL | BLOCKED_HOSTED |
| Reconnect after network interruption | PASS_STRUCTURAL | BLOCKED_HOSTED |
| Token refresh/expiry recovery | Partial code path | BLOCKED_HOSTED |
| Device selection/removal recovery | PASS_STRUCTURAL | BLOCKED_PACKAGED_WINDOWS |
| Leave/window-close/disconnect cleanup | PASS_STRUCTURAL | BLOCKED_HOSTED/NATIVE |
| No token/raw audio leakage | PASS_LOCAL review | Production observation required |

## Screen Share evidence matrix

| Required evidence | Local status | Release status |
| --- | --- | --- |
| Explicit user click before capture | PASS_STRUCTURAL | BLOCKED_PACKAGED_WINDOWS |
| Secure screen/window source picker | PASS_LOCAL IPC | BLOCKED_PACKAGED_WINDOWS |
| Cancel without capture | PASS_STRUCTURAL | BLOCKED_PACKAGED_WINDOWS |
| Full-screen source selection | Not interactively executed | BLOCKED_PACKAGED_WINDOWS |
| Application-window selection | Not interactively executed | BLOCKED_PACKAGED_WINDOWS |
| Publish screen track | PASS_STRUCTURAL | BLOCKED_HOSTED |
| Second client remote render | Not executed | BLOCKED_HOSTED/NATIVE |
| Stop and restart | PASS_STRUCTURAL | BLOCKED_HOSTED/NATIVE |
| OS-ended track cleanup | PASS_STRUCTURAL | BLOCKED_PACKAGED_WINDOWS |
| Leave/disconnect cleanup | PASS_STRUCTURAL | BLOCKED_HOSTED/NATIVE |
| No frame/content storage or logging | PASS_LOCAL review | Production/native observation required |

The previous unsigned Windows package startup is useful build evidence but is not a screen-share certification and is not the immutable signed V1 candidate.

## Official platform constraints checked

- LiveKit access tokens are JWTs signed by the API secret and carry room/capability grants: https://docs.livekit.io/home/server/generating-tokens
- Electron source enumeration uses `desktopCapturer.getSources` with `screen` and `window` source types and platform permission constraints: https://www.electronjs.org/docs/latest/api/desktop-capturer/
- Electron renderer exposure should remain a narrow `contextBridge` API: https://www.electronjs.org/docs/latest/api/context-bridge
- Supabase Edge Function secrets belong in hosted secret storage/environment variables and secret/service-role keys must not enter the browser/renderer: https://supabase.com/docs/guides/functions/secrets

## Task 643-656 dependency map

```text
642 Audit and scope lock
 |
 +--> 643 Provider/environment/secret custody
       |
       +--> 644 Deploy secure token function
       |     |
       |     +--> 645 Hosted permission/RLS authorization matrix
       |           |
       |           +--> 646 Production Voice client integration
       |                 |
       |                 +--> 647 Hosted two-client Voice validation
       |                 +--> 651 Reconnect/token/device/cleanup closure
       |
       +--> 648 Packaged Windows source-picker certification
             |
             +--> 649 Screen publish and remote render
                   |
                   +--> 650 Stop/cancel/error/cleanup closure

647 + 648 + 649 + 650 + 651
             |
             +--> 652 UI/settings/diagnostics completion
                    |
                    +--> 653 Security/privacy/abuse final gate
                           |
                           +--> 654 Reclassify both features IN_V1
                                  |
                                  +--> 655 Rebuild immutable v1.0.0 RC
                                         |
                                         +--> 656 Final Go/No-Go and public release
```

Parallel work is allowed only where dependencies do not imply evidence. Task 654 must require every critical Task 643-653 result to be `PASS`; any `BLOCKED`, `PARTIAL`, or unverified result keeps both features hidden.

## Final audit decision

**NO-GO for inclusion at Task 642.** The implementation may proceed through the evidence sequence, but Picom V1 remains truthful and fail-closed until the production provider, hosted authorization/media, packaged Windows capture, remote render, recovery, cleanup, privacy and abuse gates all pass.
