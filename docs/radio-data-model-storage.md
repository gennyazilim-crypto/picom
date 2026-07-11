# Radio Data Model and Storage

Picom Radio communities use community-kind constrained Postgres rows and private Supabase Storage. The renderer accesses them only through the audio service/data-source layer.

## Model

- `radio_programs`: recurring show/series metadata, cover path, tags, and default duration.
- `radio_program_schedules`: weekly local-time schedule entries with explicit IANA timezone and effective dates.
- `radio_program_hosts`: manager-assigned host, co-host, and producer membership for a show.
- `radio_sessions`: draft, scheduled, live, ended, or cancelled broadcast metadata; optional program and same-community listener-chat references.
- `radio_session_hosts`: per-broadcast host assignments.
- `radio_listeners`: private join/leave/heartbeat rows. Public UI uses the aggregate listener count, not listener history.
- `radio_program_follows`: user-private follows for recurring programs.
- `saved_audio_items`: existing user-private save state for a specific Radio session.
- `radio_session_reactions`: member reactions for visible live or ended sessions.

Database triggers reject non-Radio communities, cross-community program/channel references, non-member host assignments, and terminal status reversal.

## Access boundaries

- Station visibility controls program, schedule, session, host, and reaction reads.
- Draft sessions are visible only to authorized Radio managers/hosts.
- Hosting and editing require the relevant Radio capability or an explicit trusted assignment.
- Listener rows are visible only to that listener or an authorized session host/manager.
- Follows and saves are visible only to their owner.
- Reactions require membership plus `listenRadio`.

## Cover storage

The existing `audio-covers` bucket remains private. Supported object paths are:

- Session: `communities/{communityId}/radio/{sessionId}/covers/{objectId}.{ext}`
- Program: `communities/{communityId}/radio/programs/{programId}/covers/{objectId}.{ext}`

Read and write policies validate both the source object and community segment. Clients store `cover_storage_path`; short-lived signed URL resolution remains an authorized service-layer concern.

## Recording and rights boundary

Radio recording is not release-scoped. Picom creates no recording bucket, recording URL, automatic recorder, or music-rights assumption in this task. A later approved recording feature must define consent, retention, moderation, regional rights, and storage scanning before schema or storage enablement.
