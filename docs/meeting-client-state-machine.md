# Meeting client state machine

Task 542 introduces one client authority for meeting UI state without replacing the existing LiveKit voice transport or Supabase meeting services.

## Layers

- `meetingStore` owns the normalized immutable snapshot, generation counter, deterministic transition table, layout/dock/focus choices, local devices/media, Noise Shield intent/application, permissions, hands, and transient reactions.
- `meetingService` is the only orchestration entry point. It deduplicates joins, rejects stale async completions, maps provider failures to user-readable typed errors, and binds participant, waiting-room, hand, reaction, and device streams.
- `meetingLiveKitAdapter` obtains the secure meeting token and reuses `voiceService`; components never receive LiveKit `Room` objects or provider tokens.
- `meetingRepository` consolidates existing Supabase participant and waiting-room services. It contains no UI state.
- `meetingSelectors` exposes stable derived reads for components.

## Transition contract

The allowed phases are `idle`, `prejoin`, `waiting`, `token-loading`, `connecting`, `connected`, `reconnecting`, `disconnected`, `ended`, and `failed`. Invalid transitions and updates from an old generation are ignored. One in-flight join is shared for the same room/session and a different concurrent join fails with a typed error.

Mock mode uses the same state machine and service actions with deterministic authorized, waiting, and failure fixtures. It does not open a LiveKit connection or synthesize provider evidence.
