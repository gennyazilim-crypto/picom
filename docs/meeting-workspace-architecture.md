# Picom Meeting Workspace Architecture

Status: Locked for Tasks 528–582  
Owner placeholders: Desktop, Backend, Realtime, Security, QA

## Decision

Picom has one authoritative meeting stack. The existing `voiceService`, LiveKit token service, Electron capture bridge, community permission model, Supabase service layer, and message services are extended behind a typed Meeting Workspace domain and store. No parallel LiveKit client, permission system, screen picker, or ephemeral chat authority may be introduced.

```text
React Meeting Workspace
  -> meeting client service/store/state machine
  -> existing voice/device/screen services
  -> typed Supabase meeting repositories
  -> authenticated Edge Functions
  -> Supabase Postgres/RLS/Realtime + LiveKit

Electron renderer
  -> validated preload bridge
  -> focused BrowserWindow/main process
  -> explicit native capture/permission operation
```

## Canonical experience modes

| Mode | Purpose | Default media policy | Default layout |
| --- | --- | --- | --- |
| `voice` | Audio-first community room | Audio enabled by permission; video off; screen optional | `voice-lounge` |
| `meeting` | Collaborative audio/video workspace | Audio/video explicit; screen, chat, reactions, hand, waiting room configurable | `auto` |
| `stage` | Host/speaker/audience event | Hosts/speakers may publish; audience subscribes by default | `stage` |

Mode is persisted on the meeting/session record and enforced by server authorization. Layout is client presentation state and never grants media or moderation permission.

## Canonical layouts

| Layout | Valid modes | Contract |
| --- | --- | --- |
| `auto` | meeting, stage | Select by active share, stage role, pin, active speaker, and participant count |
| `voice-lounge` | voice | Avatar-led audio room with participants and compact controls |
| `grid` | meeting | Adaptive camera tile grid |
| `speaker-focus` | meeting | Primary speaker/pin plus participant filmstrip |
| `screen-share-focus` | voice, meeting, stage | Shared content is primary; participants remain in a filmstrip |
| `stage` | stage | Host/speaker stage plus audience roster/count |

Automatic priority is: active screen share, explicit host pin, stage policy, speaker focus, grid, voice lounge. A user layout choice may override presentation but not hide safety, consent, or host state.

## Capability model

Every session has these canonical flags:

```ts
type MeetingCapabilities = {
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  waitingRoom: boolean;
  audienceMode: boolean;
  chat: boolean;
  captions: boolean;
  reactions: boolean;
  raiseHand: boolean;
};
```

An effective capability is the intersection of:

1. application feature availability;
2. community kind/type settings;
3. channel/session configuration;
4. authenticated membership and role permissions;
5. waiting-room/admission and stage role;
6. provider/runtime availability;
7. privacy consent and emergency kill switches.

Frontend flags explain or hide unavailable actions. Only Supabase RLS/RPCs and Edge Functions authorize sensitive state or LiveKit grants.

## Community and channel eligibility

| Community kind | `voice` | `meeting` | `stage` |
| --- | --- | --- | --- |
| Text | Allowed when `voiceRoomsEnabled`; meeting/stage require explicit type settings and permission | Allowed | Allowed |
| Radio | Audio backstage/lounge allowed when enabled | Disabled by default; may be explicitly enabled for staff production | Allowed for host/speaker/audience sessions |
| Podcast | Audio production lounge allowed when enabled | Allowed for production collaboration when explicitly enabled | Disabled by default |

Canonical channel policy:

- Existing `voice` channels host `voice` mode and may launch an ad-hoc `meeting` only when channel capability policy permits video.
- Task 533 may add a `meeting` channel type for persistent meeting workspaces. It must extend the existing `ChannelType`, service, migration, RLS, sidebar, and permission paths.
- `stage` is an experience mode, not a separate duplicate channel stack. It is created from an eligible meeting/event configuration.
- Text channels remain the durable message authority. A meeting may link one permitted text channel for chat.
- Visitors cannot join media sessions. Public metadata may be visible only through explicit RLS projections.

## Authoritative state ownership

| State | Authority | Client projection |
| --- | --- | --- |
| Community/channel access | Supabase RLS and permission RPCs | Read-only capability explanation |
| Meeting metadata/schedule/policy | Supabase meeting records | Meeting store |
| Invitations and waiting room | Supabase RLS/RPCs | Realtime queue and local pending state |
| Host/cohost/moderator role | Supabase meeting role records/RPCs | LiveKit grant projection and UI gates |
| Participant media/tracks | LiveKit room | Meeting store track references |
| Provider participant lifecycle | Verified LiveKit webhook, reconciled with client state | Realtime meeting presence projection |
| Durable chat/attachments | Existing Picom message service and Supabase tables | Meeting chat adapter |
| Raise hand | Supabase authoritative state; bounded realtime acceleration allowed | Participant state |
| Reactions | Ephemeral bounded signal; audit aggregate only if required | Short-lived tile feedback |
| Captions | Configured server provider and consent policy | Ephemeral/live captions plus permitted transcript records |
| Layout/pin/local volume | Local store unless host pin is server-authoritative | Renderer only |
| Attendance/history | Supabase session/participant records plus verified webhook reconciliation | History views |

## Process boundaries

### Electron renderer

- Renders the Meeting Workspace and attaches LiveKit tracks to media elements.
- Owns local layout, selected devices, local volume, focus, and accessible interaction state.
- Uses typed services/store; React components do not call Supabase or LiveKit ad hoc.
- Requests capture only after explicit user action.
- Never stores raw media, access tokens, provider secrets, or transcript provider keys.

### Preload and main process

- Expose only validated, whitelisted IPC.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and current sandbox policy.
- Enumerate/validate desktop capture sources and return bounded metadata.
- Provide platform permission/runtime signals where Chromium cannot safely do so.
- Do not make community, meeting-role, or LiveKit grant decisions.

### Supabase

- Stores community/channel/session, schedule, invite, waiting-room, participant projection, chat link, attendance, consent, moderation, and audit records.
- Enforces row-level access and mutation ownership.
- Broadcasts only RLS-safe realtime projections.
- Does not store raw microphone, camera, or screen streams.

### Edge Functions

- Authenticate Supabase users and validate bounded request bodies/origins.
- Issue short-lived, room-bound LiveKit tokens using server-side credentials.
- Execute provider moderation after server permission/hierarchy checks.
- Verify LiveKit webhook raw body/signature and apply idempotent state reconciliation.
- Gate optional caption provider access and keep provider secrets server-side.

### LiveKit

- Transports realtime audio/video/screen tracks and provider participant events.
- Enforces token grants for publish sources, subscription, data, room, and identity.
- Is not the durable authority for invitations, waiting room, chat history, consent, or attendance.

### Captions provider

- Optional and disabled when unconfigured.
- Receives media only after explicit meeting policy and participant consent.
- Returns bounded caption segments through a server-controlled adapter.
- Does not expose credentials to renderer or persist transcripts outside approved retention/RLS.

## Media privacy contract

- Camera, microphone, and screen capture start only after an explicit user action.
- Prejoin preview is local and stops all tracks when closed or completed.
- No cloud/local recording is in scope.
- Raw media is never written to Supabase Storage, logs, diagnostics, analytics, crash reports, or support exports.
- Tokens, room secrets, private source names, device IDs, transcript provider credentials, and captured content are redacted.
- Screen thumbnails are bounded, transient picker data and are not persisted.
- Camera-off state uses avatar/gradient UI, not retained video frames.
- Caption consent and retention are separate from general meeting consent.

## State machine contract

Canonical phases:

```text
idle -> resolving -> prejoin -> waiting -> joining -> connected
connected -> reconnecting -> connected
connected -> leaving -> ended
any active phase -> permission_blocked | denied | failed | ended
```

- One transition function validates every state change.
- Stale async results carry an operation/session generation and cannot overwrite a newer room.
- Switching rooms first releases prior tracks, listeners, subscriptions, timers, previews, and IPC selection sessions.
- Reconnect preserves local mute/deafen/camera/layout intent but revalidates server capability and admission.
- Revocation, removal, end, or lock events fail closed.

## Degraded-state contract

| Failure | Required behavior |
| --- | --- |
| Supabase unavailable | Existing active media may remain briefly; new joins, moderation, waiting, chat writes, and token refresh fail closed |
| LiveKit unavailable | Show recoverable provider state; no fake participants or connected status |
| Camera denied/unavailable | Continue audio-only if policy permits; explain recovery |
| Microphone denied/unavailable | Join listen-only if permitted; never claim audio is publishing |
| Screen permission denied | Keep meeting connected and show platform guidance |
| Captions provider absent | Hide captions entry point or show configured-unavailable state; never fake captions |
| Realtime degraded | Poll/reconcile bounded server state for critical admission/role changes; show stale-state indicator |
| Webhook delayed/duplicate | Idempotent event ledger and client/provider reconciliation prevent duplicate attendance transitions |
| Noise Shield unavailable | Use documented browser fallback and truthfully label it; hide advanced control if foundation is absent |

## Accessibility contract

- Every control has text or an accessible name and visible `:focus-visible` state.
- Keyboard navigation covers dock, tiles, menus, tabs, waiting queue, and layout controls.
- Focus moves predictably when dialogs/docks open and returns to the invoking control.
- Connection, permission, waiting, hand, mute, caption, and host changes use polite live announcements.
- Reactions and speaking feedback are not communicated by color alone.
- Reduced-motion mode disables tile movement, reaction flight, pulsing aura, and animated layout transitions.
- Captions have readable contrast, size controls, speaker labels, and a non-overlay placement option.

## Performance strategy

- Lazy-load the complete Meeting Workspace and feature CSS from the selected meeting/voice route.
- Keep LiveKit meeting UI, camera helpers, captions, mock fixtures, and provider adapters out of the startup graph.
- Reuse `livekit-client`; do not add a second meeting component framework without measured justification.
- Keep `adaptiveStream` and `dynacast` enabled.
- Attach only visible/required video tracks; use selective subscription for stage/audience and large rooms.
- Prefer mute/pause/subscription changes over unpublish/republish churn where safe.
- Virtualize long people/chat/attendance lists.
- Batch low-priority participant quality updates.
- Enforce Task 573 JS/CSS/memory/CPU/bandwidth budgets before certification.

## Dependency map for Tasks 530–582

| Tasks | Dependency | Deliverable gate |
| --- | --- | --- |
| 530 | 529 | Canonical types, roles, capabilities, states, layouts |
| 531 | 530 | Supabase meeting schema/migrations |
| 532 | 531 | RLS, grants, permission matrix, pgTAP contracts |
| 533 | 530–532 | Community/channel/session creation integration |
| 534 | 531–533 | Scheduling, invitations, join policy |
| 535 | 530, 532–534 | Secure meeting-aware LiveKit token function |
| 536 | 531, 535 | Verified/idempotent webhook synchronization |
| 537 | 531–536 | Waiting room and realtime admission |
| 538 | 536–537 | Participant/presence reconciliation |
| 539 | 531–538 | Durable Picom meeting chat binding |
| 540 | 530, 532, 538 | Reaction/raise-hand signaling backend |
| 541 | 534, 537–540 | Reminders and host alerts |
| 542 | 530–541 | Single client service/store/state machine |
| 543 | 542 | Lazy Meeting Workspace shell/canvas |
| 544–545 | 542–543 | Prejoin and camera/microphone preview/device services |
| 546–551 | 543–545 | Voice, grid, focus, share, stage, and participant tile modes |
| 552–560 | 537–551 | Dock, right panel, waiting, invite, moderation, reaction, layout, mini meeting |
| 561 | 521–527 plus 542, 552 | Noise Shield integration; blocked until its prerequisite foundation exists |
| 562–565 | 535–563 | Adaptive video, production share, device recovery, reconnect/token cleanup |
| 566 | 539, 553 | Meeting chat UI |
| 567 | 553, 569 consent design | Captions/transcript behind configured provider |
| 568–571 | 531–567 | History, privacy, abuse controls, observability |
| 572–573 | 543–571 | Accessibility and performance/bandwidth gates |
| 574 | 530–573 | Unit/integration/contract suite |
| 575 | 535–574 | Hosted two-client E2E |
| 576 | 550, 562, 574–575 | Multi-participant stage/load validation |
| 577 | 531–576 | Hosted Supabase/LiveKit/Edge final validation |
| 578–580 | 563–577 | Windows, Linux, macOS native certification |
| 581 | 532, 536, 569–580 | Final security/privacy/RLS gate |
| 582 | 528–581 | Production-readiness audit and truthful Go/No-Go |

Task 582 cannot return Go while any required hosted/native/security evidence remains blocked.
