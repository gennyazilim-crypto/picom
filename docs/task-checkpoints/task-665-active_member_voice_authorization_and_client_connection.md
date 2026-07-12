# Task 665 Checkpoint: Active Member Voice Authorization and Client Connection

## Status

Client implementation and local real-provider audio: **PASS**

Hosted self-hosted staging token/media matrix: **BLOCKED**

Voice Rooms remain visible and active in V1.

## Delivered

- Existing one-stack `VoiceRoomView`/`voiceService`/Supabase token path retained.
- Role-independent active-member join/speak policy locked.
- Visitor/non-member/banned/suspended/removed/cross-community denial retained.
- Duplicate join/Room guards, leave cleanup, reconnect, participant list, speaking and quality state verified.
- Settings input/output and Standard Noise Shield integration verified.
- Exact auth/access/rate/provider/token/permission/ended-room guidance verified.
- Moderator controls remain separately role-gated.
- UI copy identifies Picom self-hosted LiveKit without exposing provider details.

## Validation

- `npm run voice:self-hosted:member:smoke`: PASS
- `npm run voice:client:smoke`: PASS
- `npm run livekit:smoke`: PASS
- Task 659 native local server + two-client E2E: PASS
- `npm run typecheck`: PASS
- hosted Task 664 role/media matrix: BLOCKED, staging unavailable

Redacted evidence: `docs/evidence/task-665-active-member-voice-client.json`.

## Remaining blockers

- Real self-hosted staging endpoint/token deployment.
- Internet/TURN and packaged native evidence in later tasks.
- Public stable release gate remains No-Go until Task 674; product feature visibility remains enabled.
