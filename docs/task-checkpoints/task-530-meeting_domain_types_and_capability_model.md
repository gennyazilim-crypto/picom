# Task 530 - Meeting domain types and capability model

## Result

- Added one canonical meeting domain for rooms, sessions, participants, roles, capabilities, layouts, tracks, invitations, waiting-room entries, reactions, raised hands, connection state, and events.
- Added explicit community-channel, scheduled-event, and approved ad-hoc sources.
- Added durable room status and separate provider/session connection state.
- Added immutable host/cohost/speaker/participant/viewer/guest capability defaults and community access mapping.
- Adapted existing voice types through canonical projections without changing runtime behavior.
- Added safe backend/provider/client serialization boundaries that exclude tokens and raw media.
- Added deterministic voice, meeting, stage, camera-off, screen-share, waiting-room, and failure fixtures.

## Files

- `src/types/meeting.ts`
- `src/services/meeting/meetingCapabilityService.ts`
- `src/data/mockMeetingFixtures.ts`
- `src/types/voice.ts`
- `src/services/voiceService.ts`
- `scripts/meeting-domain-model-smoke.mjs`
- `docs/meeting-domain-model.md`
- `docs/task-checkpoints/task-530-meeting_domain_types_and_capability_model.md`

## Validation

- `node scripts/meeting-domain-model-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run qa:smoke`
- `npm run build`

No hosted/native provider evidence is required for this type-only domain task. Existing external release blockers remain unchanged.

Expected commit: `feat add canonical meeting domain model`.
