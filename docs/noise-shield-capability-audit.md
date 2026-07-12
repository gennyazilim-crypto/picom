# Noise Shield Audio Processing Capability Audit

Audit date: 2026-07-12  
Task: 521  
Scope: read-only review of the committed Picom voice, device, LiveKit, meeting, settings, diagnostics, and media playback architecture

## Executive result

Picom already has one authoritative LiveKit voice stack. Noise Shield must extend that stack rather than create a second microphone or room implementation.

- `voiceService` owns room connection, mute/unmute, microphone recreation, input switching, reconnect, leave, camera, and screen-share state.
- `voiceDeviceService` owns permission-aware input/output discovery, selected devices, WebRTC processing preferences, local microphone metering, device-change recovery, and test-resource cleanup.
- `noiseShieldService` and `noiseShieldStore` already expose a meeting-scoped requested/applied model, but currently resolve only `off` and Chromium-native `standard`.
- Meeting PreJoin, Control Dock, Meeting Info, Voice Lounge, and Connected Meeting already consume that requested/applied state.
- `voiceRoomService` is only a compatibility re-export of `voiceService`; it is not a second stack.
- Radio and Podcast playback use `audioPlayerService`/HTML audio paths and are separate from microphone publication.
- Screen-share capture uses its own desktop source and never enters the microphone processing path.

Standard processing can be completed with supported WebRTC capture constraints. Enhanced and Voice Focus require an optional official LiveKit processor integration and must remain unavailable or fall back to Standard until that dependency and provider entitlement are explicitly present.

## Installed runtime and dependencies

| Item | Audited value | Consequence |
| --- | --- | --- |
| Electron | `43.0.0` from lockfile | Electron 43 embeds Chromium `150.0.7871.46`, Node `24.17.0`, and V8 `15.0`. Runtime capability checks still take precedence over version assumptions. |
| LiveKit client | `2.20.0` from lockfile | `LocalAudioTrack.setProcessor()` and `stopProcessor()` are available in this SDK line. |
| Enhanced processor | Not installed | No Enhanced/Voice Focus capability may be advertised as active. |
| Official browser processor path | `@livekit/krisp-noise-filter` | Must be dynamically imported only after an explicit mode request; models download at runtime. Provider/browser support must be checked. |
| React/Vite | Existing renderer stack with `cssCodeSplit: true` | A local dynamic import boundary can keep optional processor code out of the initial graph. |

Primary references:

- LiveKit noise cancellation: <https://docs.livekit.io/home/cloud/noise-cancellation>
- LiveKit JS `LocalAudioTrack` 2.20.0: <https://docs.livekit.io/reference/client-sdk-js/classes/LocalAudioTrack.html>
- Electron 43 runtime versions: <https://www.electronjs.org/blog/electron-43-0>

No dependency is added by Task 521. The optional package must pass license, bundle, provider, and runtime-support review before it can be enabled.

## Current voice and track lifecycle

| Event | Current path | Current cleanup/recovery | Audit finding |
| --- | --- | --- | --- |
| First voice join | `voiceService.join` or `connectAuthorizedToken` -> `connectWithToken` | Existing room is disposed before replacement | Authoritative path exists. |
| Microphone enable | `setMicrophoneWithMeetingProcessing` -> `localParticipant.setMicrophoneEnabled(true, constraints)` | Errors fall back to a basic microphone track | Must verify actual settings and attach an optional processor only to the published microphone track. |
| Mute/unmute | `voiceService.setMuted` | Reuses or recreates through the same helper | Selected mode must survive both behaviors. |
| Input switch | `voiceDeviceService.selectInput` -> preference notification -> `applyVoiceDevicePreferences` | Old capture is disabled before re-enable when live | Must detach processor before replacement and reapply once. |
| Device removal | debounced `devicechange` -> `refresh(false)` | Falls back to an available/default input and publishes a notice | Must preserve the requested mode while recomputing supported/applied mode. |
| Permission denial/revocation | permission observer and explicit refresh | Test stream stops; active microphone is disabled | No automatic repeated prompt; UI must expose recovery. |
| Permission grant | permission observer -> refresh | Devices/capabilities are refreshed | Processing must be reapplied only after explicit capture action. |
| Reconnect | `voiceService.reconnect` and generation guards | Prior room is disposed; duplicate reconnects are coalesced | Processor/listener generation must follow the replacement track. |
| Leave | `voiceService.leave` -> `disposeRoom` | Room/tracks/screen-share/listeners/state are cleared | Noise processor and optional worklet/model must also be disposed. |
| Meeting leave | `meetingService.leave` -> LiveKit adapter disconnect | Noise Shield store is reset | The canonical persisted preference must remain, while session-applied state resets. |
| Settings close | `VoiceDeviceSelection` cleanup | Local microphone test stops and listeners unsubscribe | No hidden capture remains. |
| App/window close | room disposal path plus Electron shutdown | Existing voice cleanup is expected | Add an explicit Noise Shield lifecycle disposal hook and deterministic contract. |

The main lifecycle risk is that current processing is represented as capture constraints only. There is no processor instance identity, attachment generation, initialization status, or disposal state to protect an Enhanced processor from duplicate attachment.

## Current WebRTC constraints

`voiceDeviceService` detects and persists:

- `echoCancellation`
- `noiseSuppression`
- `autoGainControl`
- selected `deviceId`
- input sensitivity for the local meter

`noiseShieldService.createMicrophoneCapturePlan()` currently forces supported Standard suppression for an active meeting and also enables supported echo cancellation and automatic gain. This conflates the Noise Shield mode with two independent preferences and does not inspect the resulting `MediaStreamTrack.getSettings()` values.

Required correction:

- Off controls only `noiseSuppression`.
- Echo cancellation and automatic gain remain independently user-controlled.
- Unsupported properties are omitted rather than required with `exact` constraints.
- Device selection remains exact only for an explicitly selected device; device failure falls back to system default.
- After capture, safe boolean/string settings are inspected and reported without retaining media or full device labels.

No sample rate or channel count is currently forced. That is appropriate for the baseline and avoids unnecessary capture failure.

## Runtime capability detection

Capability decisions must combine, in this order:

1. `navigator.mediaDevices` and `getUserMedia` availability.
2. `getSupportedConstraints()` for echo, suppression, gain, and device ID.
3. Actual `MediaStreamTrack.getSettings()` after capture.
4. LiveKit microphone publication source and `LocalAudioTrack` processor methods.
5. Dynamic Enhanced provider module support check.
6. Provider entitlement/model initialization result.
7. Platform/runtime-specific failure code.

`AudioWorklet`, WebAssembly, cross-origin isolation, or a browser version alone must not cause Picom to claim Enhanced support. The official processor's support function and a successful initialization/attachment are required.

## Product behavior matrix

| Mode | Full MVP status | Required path | Truthful applied result | Fallback |
| --- | --- | --- | --- | --- |
| Off | Required | Microphone capture with supported suppression disabled; independent echo/gain retained | `off` after settings verification | Basic microphone if a constraint is omitted/unsupported |
| Standard | Required/default voice-processing mode | Supported Chromium WebRTC suppression plus independent echo/gain | `standard` or `standard-partial` | Basic microphone with an explicit partial/unavailable reason |
| Enhanced | Conditional | Dynamically loaded official LiveKit/Krisp NC processor attached to `Track.Source.Microphone` | `enhanced` only after support, model readiness, and `setProcessor()` succeed | Standard without disconnecting the call |
| Voice Focus | Conditional, opt-in | Official BVC/background-voice model where entitled and supported | `voice-focus` only after model confirmation | Standard, with a shared-microphone warning retained |

Voice Focus is never the default. It can suppress nearby real speakers and is unsuitable for shared microphones, interviews around one device, music, or studio sources.

## Source-isolation contract

Noise Shield is allowed only for a local LiveKit publication where all are true:

- track kind is audio;
- publication source is `Track.Source.Microphone`;
- track is a `LocalAudioTrack`;
- current intent is voice/meeting speech;
- the user explicitly enabled microphone capture.

It must never receive or mutate:

- Electron desktop/system-audio screen-share tracks;
- remote participant tracks;
- Radio playback;
- Podcast playback;
- uploaded audio/music playback;
- Radio host/studio music source tracks;
- HTML audio elements or the global audio player.

The current architecture already separates these paths. New code must keep imports one-way: voice processing may know about a microphone track, but audio players and screen sharing must not import Noise Shield.

## Privacy, performance, and reliability risks

| Risk | Required control |
| --- | --- |
| Optional SDK/model enters initial bundle | Local dynamic import boundary; verify Vite manifest entry graph and performance budget. |
| Runtime model download or provider entitlement fails | Keep the call connected and atomically fall back to Standard. |
| Processor attaches twice after reconnect/device switch | Track identity plus generation guard; detach/dispose before replacement. |
| Old worklet/context/listener survives leave | One lifecycle manager owns processor, listeners, timers, and disposal. |
| CPU/memory growth or audio dropouts | Bounded diagnostics, mode-switch timing, long-session cleanup contract, manual acoustic matrix. |
| Requested mode shown as applied | Separate requested, resolved, processor, and verified-applied state. |
| Raw audio leaks into diagnostics | Record only booleans, durations, redacted device hash, mode/status, and stable error codes. |
| Unsupported platform falsely enabled | Official support function plus successful attachment; otherwise disabled or Standard fallback. |

## Exact extension plan for Tasks 522-527

| Task | Primary files |
| --- | --- |
| 522 | `src/types/audioProcessing.ts`, `src/services/voice/audioCapabilitiesService.ts`, `src/services/voice/audioCaptureOptionsService.ts`, `src/services/voice/noiseCancellationService.ts`, compatibility facade/store, `voiceService`, Standard contracts |
| 523 | `src/services/voice/enhancedNoiseFilterService.ts`, lazy runtime adapter, processor lifecycle types/contracts, Enhanced docs |
| 524 | New Noise Shield settings/quick-control components and styles; minimal integrations in `VoiceDeviceSelection`, `VoiceRoomView`, Meeting Control Dock/Connected Mini where required |
| 525 | Authoritative microphone processing lifecycle manager, `voiceService` replacement/reconnect/leave/device hooks, deterministic cleanup tests |
| 526 | Privacy-safe diagnostics service/panel, acoustic QA matrix, performance and failure-injection harness |
| 527 | Final local matrix, manifest/budget/license checks, known limitations, hosted/native BLOCKED evidence |

## Recommended order

1. Canonicalize mode/settings/capability/applied-result types and Standard capture planning.
2. Route the real LiveKit microphone path through that plan and verify applied settings.
3. Add a lazy official-processor boundary with a Standard fallback and no package claim when absent.
4. Expose requested versus applied state in Settings, active voice, and connected mini controls.
5. Consolidate track replacement and cleanup ownership.
6. Add redacted diagnostics, failure injection, acoustic/manual QA, performance evidence, and final certification matrix.

## Audit decision

- Standard implementation path: **READY**
- Enhanced/Voice Focus package/provider: **BLOCKED / CONDITIONAL**
- Existing voice stack reuse: **REQUIRED**
- Raw-audio persistence/upload: **PROHIBITED**
- Native/provider certification: **NOT CLAIMED**

