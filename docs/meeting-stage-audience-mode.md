# Meeting Stage and Audience Mode

Picom stage rooms separate publishing participants from the audience without relying on renderer-only checks.

## Roles and media policy

- `host`, `cohost`, and `speaker` are stage roles and may publish only capabilities authorized by the meeting token.
- `participant`, `viewer`, and `guest` remain in the audience. Viewer and guest tokens cannot publish microphone, camera, or screen-share tracks.
- The stage renderer subscribes camera video only for stage identities. Audience members remain available in the authoritative participant list without creating an unbounded video grid.
- Waiting-room admission does not imply stage access. Admitted guests still receive their authoritative role and capabilities.

## Request-to-speak flow

Audience members submit or cancel a request through the existing authoritative hand queue. Hosts and cohosts approve or deny requests. Approval calls the hierarchy-safe stage role function, updates the runtime request state, and relies on participant reconciliation to update every client.

The Participants and Viewers tabs are projections of the authoritative participant snapshot. They are not security boundaries.

## Authorization refresh

When realtime reconciliation changes the local participant role, the client immediately applies the new capability floor. A demoted client is muted before a deduplicated token refresh reconnects it with server-issued LiveKit grants. The UI never upgrades its own token or derives publish rights from a button state.

## Audit and security

`manage_meeting_stage_participant` delegates role mutation to `set_meeting_participant_role`, preserving role hierarchy, self-escalation protection, ordered meeting events, and audit logging. The wrapper is executable only by authenticated users; the delegated function enforces host/cohost authority.

Hosted RLS and LiveKit grant validation remain release evidence and require configured Supabase and LiveKit staging environments.
