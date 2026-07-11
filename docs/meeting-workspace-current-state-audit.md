# Picom Meeting Workspace Current-State Audit

Audit date: 2026-07-11  
Task: 528  
Scope: read-only inspection of the existing desktop voice, camera, screen-share, LiveKit, Supabase, permissions, messaging, Noise Shield, QA, and release evidence.

## Executive status

Foundation readiness: **58/100, production-blocked for the Meeting Workspace scope**.

Picom already has a credible, permission-gated Voice Room and Electron screen-share foundation. It does not yet have a Meeting Workspace domain or camera meeting experience. The current implementation must be extended rather than replaced, but a stable release cannot claim meeting, video, waiting-room, captions, stage/audience, hosted media, or native cross-platform certification yet.

## Evidence inspected

| Area | Evidence |
| --- | --- |
| Renderer | `src/components/VoiceRoomView.tsx`, `src/components/VoiceDevicePanel.tsx`, `src/components/voice/*`, `src/components/FeedCompanionRail.tsx`, `src/App.tsx` |
| Client services | `src/services/voiceService.ts`, `src/services/livekit/*`, `src/services/voiceDeviceService.ts`, `src/services/voiceSessionRecoveryService.ts`, `src/services/screenCaptureService.ts` |
| Electron | `electron/main.cts`, `electron/preload.cts`, `src/types/picomDesktop.d.ts` |
| Authorization | `src/services/permissions/communityPermissions.ts`, `src/services/permissions/communityPermissionCatalog.ts`, Task 501/506 migrations and Edge Functions |
| Backend | `supabase/functions/livekit-token`, `supabase/functions/livekit-moderation`, `supabase/migrations/20260711150100_*`, `supabase/migrations/20260711150600_*` |
| Messaging | `src/services/messageService.ts`, current channel types and composer permission behavior |
| Quality | voice, device, reconnect, screen-share, Electron security, Supabase, performance, and release-blocker scripts/docs |
| Installed SDK | `livekit-client@2.20.0`; no `@livekit/components-react` dependency |

The installed SDK path agrees with the official LiveKit JavaScript client guidance for camera/microphone helpers, track publications, connection events, and adaptive video: [JS SDK 2.20.0](https://docs.livekit.io/reference/client-sdk-js/), [camera and microphone](https://docs.livekit.io/transport/media/publish/), [track management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/tracks/), and [webhooks/events](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).

## Current architecture

```text
Community voice channel
  -> App permission/type guard
  -> voiceService singleton state boundary
  -> liveKitService
  -> authenticated Supabase Edge Function
  -> authorize_livekit_room RPC
  -> short-lived, least-privilege LiveKit token
  -> LiveKit Room (adaptiveStream + dynacast)

Screen share
  -> explicit renderer picker action
  -> validated preload IPC
  -> trusted/focused BrowserWindow check
  -> desktopCapturer bounded source session
  -> renderer source revalidation
  -> getUserMedia for approved Electron source
  -> LiveKit ScreenShare publication
```

The renderer does not receive the LiveKit API secret. UI components call services, not provider APIs directly. The Electron bridge exposes bounded data and validates sender, request shape, focus, source ID, count, and expiry.

## Existing flow map

| Flow | Current implementation | Classification | Important limitation |
| --- | --- | --- | --- |
| Join | Community membership, kind settings, channel visibility, `joinVoice`, bans/timeouts, and private-channel rules are checked before a token is issued | Real local/provider path | Hosted deployment and two-client proof are blocked |
| Leave | Stops local tracks, removes listeners, disconnects, cancels reconnect, and clears room context | Real | No durable meeting attendance/session finalization |
| Mute | Calls `LocalParticipant.setMicrophoneEnabled` with selected capture constraints | Real | No meeting-specific host state projection |
| Deafen | Locally unsubscribes/resubscribes remote audio publications | Real local control | Not a server-visible participant attribute |
| Participants | Local and remote participants, speaking, microphone state, and names derive from LiveKit events | Real | No camera, role, hand, stage, or waiting state |
| Speaking | Uses `ActiveSpeakersChanged` and participant identity set | Real | Hosted audio verification is blocked |
| Connection quality | Tracks local `ConnectionQualityChanged` and redacted diagnostics | Real | UI does not yet expose per-participant quality |
| Reconnect | Handles LiveKit reconnect states; sleep/wake recovery refreshes devices and uses bounded retries | Real | No Meeting Workspace state machine or token-expiry UI |
| Connected Voice | Feed rail card reflects the singleton voice snapshot and exposes mute/deafen/leave/screen-share navigation | Real local state | Not backed by durable meeting session data |
| Active room discovery | Existing service projects visible community voice rooms into the companion rail | Partial | Not a provider-authoritative meeting directory |
| Device selection | Explicit microphone permission, input/output selection, test meter/tone, device-change recovery | Real local/native browser capability | Camera devices and prejoin preview are absent |
| Audio processing | Browser-supported echo cancellation, noise suppression, and automatic gain constraints | Real browser constraints | This is not the requested Noise Shield system |
| Screen source picker | Explicit Electron desktopCapturer request with validated, expiring selection session | Real Electron path | Native packaged evidence remains blocked |
| Screen publish | Reissues a screen-capable token, captures the selected source, publishes a ScreenShare track, renders remote tracks, and cleans up | Real implementation | Token upgrade reconnects the room; no focus/filmstrip layout |
| Voice moderation | Server-side mute/remove with hierarchy-aware RPC and audit attempt | Real backend path | Provider action and audit insert cannot be one cross-system transaction |
| Voice chat | Community messaging intentionally rejects text writes to voice channels | Missing for meeting | No durable meeting-chat binding exists |
| Notifications | General notification/reminder infrastructure exists | Partial foundation | No meeting invite, admission, host alert, or lifecycle events |

## Capability gap table

| Requested capability | Status | Reuse path | Gap to close |
| --- | --- | --- | --- |
| Voice Lounge | Partial / strong foundation | `VoiceRoomView`, `voiceService`, device and moderation services | Meeting shell, dock, participant context controls, durable session state |
| Video Grid | Missing | Extend LiveKit participant/track model | Camera permission/preview, camera publish, remote video attachment, adaptive grid |
| Speaker Focus | Missing | Active speaker events already exist | Focus selection, primary tile, filmstrip, pin/layout state |
| Screen Share Focus | Partial | Existing local/remote share track lifecycle | Promote share to stage, filmstrip, layout recovery, quality policy |
| Stage/Audience | Missing | Community roles and permission catalog | Meeting roles, stage grants, request-to-speak, audience subscription policy |
| PreJoin | Missing | Voice device service | Camera/mic preview, device checks, persisted choices, consent and join policy |
| Waiting Room | Missing | Supabase Realtime/RLS patterns | Session/admission schema, RPCs, realtime host queue, admit/deny UI |
| Right Dock | Missing | Existing member list and message components | One People/Chat/Captions/Info dock and meeting-scoped state |
| Host/Cohost moderation | Partial | Existing mute/remove function and hierarchy | Host/cohost model, participant menu, admission, stage, lock/end actions |
| Durable meeting chat | Missing | Existing message service and attachments | Meeting/channel binding, RLS, realtime, history policy; no LiveKit-only ephemeral authority |
| Reactions / raise hand | Missing | Realtime/data abstractions | Typed bounded signaling, state expiry, rate limits, reduced-motion UI |
| Scheduled meetings/invites | Missing | Community events/invite foundations | Meeting records, invitees, join policy, reminders, attendance |
| Captions/transcript | Missing / provider-blocked | None in meeting path | Consent, provider adapter, secret boundary, retention/RLS, truthful disabled state |
| Noise Shield | Missing | Browser noise suppression constraint only | Tasks 521–527 are not present in current source/checkpoints; no branded service/state/quality/fallback chain |
| LiveKit webhooks | Missing | Edge Function patterns | Raw-body signature verification, idempotency, event ordering, session reconciliation |
| Attendance/history | Missing | Audit/event patterns | Session/participant timestamps, privacy projection, retention and export |
| Observability | Partial | Voice diagnostics counters and redacted logging | Meeting IDs, phase/error taxonomy, quality aggregates, support bundle contract |
| Accessibility | Partial generic controls | Existing AppIcon/buttons/focus tokens | Meeting keyboard map, focus management, announcements, captions, reduced motion |

## Backend and security findings

### Existing strengths

- Token issuance requires an authenticated Supabase user and a valid community/channel UUID pair.
- Authorization is server-side and checks active membership, bans, timeouts, visibility, private-channel access, community type settings, and scoped voice permissions.
- Tokens are ten-minute, room-bound, identity-bound, source-limited, subscribe-enabled, and data-publish-disabled.
- Screen and microphone grants are separated by intent.
- Moderation is server-side through `livekit-server-sdk`, with hierarchy checks and an audit RPC.
- LiveKit credentials remain in Edge Function environment variables.
- The official token model confirms that LiveKit grants and secrets belong on the backend: [tokens and grants](https://docs.livekit.io/home/server/generating-tokens).

### Missing production boundaries

- There are no meeting, meeting participant, invite, waiting-room, attendance, reaction, caption, or transcript tables.
- There are no meeting RLS policies or meeting-scoped RPCs.
- There is no verified LiveKit webhook receiver. Official guidance requires the raw body plus signed authorization validation and notes retry/delivery behavior; this must be implemented idempotently before webhook state is authoritative.
- `canPublishData` is false, so reactions/hand/caption signaling is not currently available through LiveKit data packets.
- No provider event reconciles LiveKit participant state with Supabase.
- No durable lifecycle closes attendance when a client crashes or a webhook arrives late.
- Meeting rate limits and abuse controls do not yet exist. Voice moderation currently shares the token-request rate-limit action.

## Camera and media findings

- Camera capture is explicitly not requested by the current Full MVP settings screen.
- No camera device list, camera preview, `setCameraEnabled`, camera track publication, or camera track renderer is present.
- Screen sharing uses a custom Electron source picker and publishes an approved `MediaStreamTrack`, which is compatible with the installed SDK's documented custom-track path.
- `adaptiveStream` and `dynacast` are already enabled for room connections, but they have no effect on absent camera tiles and need visibility-aware video elements to deliver the intended benefit.
- Remote screen tracks are attached through `MediaStream` objects and cleaned on unsubscribe/unpublish/participant disconnect.
- Raw microphone and screen content is not stored or logged.

## Noise Shield finding

No Task 521–527 checkpoint, commit, service, store, UI, processor, provider adapter, or QA contract exists in the inspected checkout. The only related capability is Chromium/WebRTC `noiseSuppression`, alongside echo cancellation and automatic gain control. It is accurate to label this **browser noise suppression**, not **Noise Shield**. Task 561 must integrate a real implementation delivered by Tasks 521–527 or explicitly fail closed/hide the control.

## Performance and bundle constraints

Latest measured renderer budget from the current checkout:

| Metric | Current | Hard cap | Headroom |
| --- | ---: | ---: | ---: |
| Initial JavaScript | 1632.9 KiB | 1650.0 KiB | 17.1 KiB |
| Initial CSS | 233.2 KiB | 240.0 KiB | 6.8 KiB |
| Total assets | 2855.8 KiB | 3500.0 KiB | 644.2 KiB |
| Largest entry chunk | 1388.6 KiB | Informational | High |

Meeting UI, video helpers, captions, and mock fixtures cannot be added to the synchronous entry graph. The Meeting Workspace must be one lazy feature boundary with feature-scoped CSS. Camera/video tiles should use SDK-native tracks directly and avoid a second component framework unless measured benefit justifies its bundle cost.

## Tests and evidence status

| Evidence | Status |
| --- | --- |
| Local LiveKit/token/device/reconnect/screen-share contracts | PASS in existing Task 501–507 checkpoints |
| Electron IPC and renderer native boundary contracts | PASS in existing checkpoints |
| Typecheck, mock smoke, build, QA smoke | PASS in latest completed local quality run |
| Performance hard caps | PASS, with very limited initial JS/CSS headroom |
| Hosted token function and authorization matrix | BLOCKED: no deployed staging/provider environment in this audit |
| Two-client audio, speaking, reconnect, moderation | BLOCKED: no hosted room and two controlled clients |
| Remote screen frame and cleanup | BLOCKED: no two-client native execution |
| Windows packaged meeting/screen certification | BLOCKED |
| Linux X11/Wayland/PipeWire certification | BLOCKED |
| macOS signed/notarized camera/microphone/screen certification | BLOCKED |
| Meeting-specific unit/E2E/load/security suite | Missing; planned by Tasks 574–581 |

No hosted or native result is inferred from source-level checks.

## Highest risks

1. Meeting schema, RLS, and authoritative lifecycle do not exist.
2. No camera/prejoin/video rendering path exists.
3. Provider state is not reconciled by a verified, idempotent webhook.
4. Meeting chat, waiting room, invitations, attendance, reactions, and hand state have no durable boundary.
5. Noise Shield prerequisites referenced by this task pack are absent.
6. Initial JS and CSS budgets have too little headroom for eager meeting imports.
7. Hosted and native media behavior remains unproven across every promised platform.

## Extension decision

Keep and extend:

- `voiceService` media lifecycle concepts, then move them behind the meeting store/state machine introduced by Task 542.
- `liveKitService` as the renderer token boundary.
- current Edge Function auth/CORS/body/rate-limit patterns.
- community permission catalog and server RPC authorization.
- Electron source picker and source-session validation.
- voice device and sleep/wake recovery services.
- connected voice rail integration and redacted diagnostics.

Do not create:

- a second LiveKit client singleton;
- direct provider calls from React components;
- an ephemeral-only meeting chat authority;
- frontend-only host/waiting-room permissions;
- a fake Noise Shield toggle;
- eager meeting imports in `App.tsx`;
- recording, AI summaries, breakout rooms, virtual backgrounds, or livestream placeholders.

## Recommended implementation sequence

Proceed with Task 529 architecture/scope lock, then define the shared domain and capability model before schema work. Complete schema/RLS/token/webhook/waiting-room foundations before making UI controls actionable. Keep provider and native certifications blocked until Tasks 575–580 can execute in real environments.
