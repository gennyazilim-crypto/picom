# Picom Meeting Domain Model

## Canonical ownership

`src/types/meeting.ts` is the canonical TypeScript boundary for meeting rooms, sessions, participants, roles, capabilities, layouts, tracks, waiting-room entries, invitations, reactions, raised hands, connection state, and events.

Existing voice code remains compatible:

- `VoiceConnectionStatus` derives from `MeetingTransportConnectionState`.
- `VoiceRoomContext` derives from the canonical room context.
- `VoiceParticipant` is a compatibility projection of `MeetingParticipant`.
- `src/types/voice.ts` re-exports canonical meeting types instead of defining a second meeting model.

## Room sources and lifecycle

Room sources are explicit discriminated unions:

- community voice/meeting channel;
- scheduled community event;
- approved ad-hoc room with creator and approver identity.

Room status is `scheduled`, `open`, `live`, `ended`, `cancelled`, or `locked`. Session status and transport connection state are separate so provider reconnect/error state cannot overwrite the durable room lifecycle.

## Roles and capabilities

The role model supports host, cohost, speaker, participant, viewer, and guest. `meetingCapabilityService` owns immutable defaults and maps owner/admin/moderator/member/visitor access plus existing community Voice permissions into meeting capabilities.

Frontend capability checks are UX only. Task 532 must enforce equivalent Supabase RLS/RPC policies, and Task 535 must mint LiveKit grants server-side from authoritative access.

## Serialization boundaries

- `MeetingBackendSnapshot` contains durable application records and safe projections.
- `MeetingProviderEvent` contains only normalized LiveKit event metadata, never provider tokens or raw media.
- `MeetingClientStoreSnapshot` contains render/store state, never credentials, signed URLs, `MediaStream`, or raw provider objects.
- `SerializedMeetingEventEnvelope` carries versioned application events.

Provider payloads must be validated and projected before entering the client store. Access/refresh tokens, LiveKit tokens, provider secrets, microphone/camera/screen media, and raw webhook payloads are excluded.

## Deterministic fixtures

`src/data/mockMeetingFixtures.ts` provides fixed-ID/fixed-time fixtures for:

- voice lounge;
- standard meeting;
- stage/audience mode;
- camera-off participants;
- screen-share focus;
- waiting room;
- connection failure.

Fixtures are development/test inputs only and do not imply hosted LiveKit or native platform certification.
