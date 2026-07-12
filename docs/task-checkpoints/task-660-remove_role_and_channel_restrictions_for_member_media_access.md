# Task 660 checkpoint: remove role and channel restrictions for member media access

## Result

- Added one canonical active-member gate for ordinary Voice and Screen access.
- Removed role, private-channel, and channel-override requirements from Voice discovery, join, audio publication, and screen publication.
- Denied visitors, removed members, deleted profiles, bots, actively banned members, and actively timed-out members.
- Preserved community scoping and Voice-channel ownership validation.
- Preserved role-aware mute/remove moderation and actor-above-target hierarchy.
- Updated renderer UX gates, generated RPC types, structural smoke coverage, and hosted validation fixtures including a roleless member.

## Security boundary

Frontend membership checks are UX only. `authorize_livekit_room` and `list_visible_voice_rooms` enforce the active-member policy server-side. `authorize_livekit_voice_moderation` remains the separate privileged moderation boundary.

## Evidence

Validation commands and outcomes are recorded in the task commit report. Real hosted matrix execution requires the Task 665 staging fixture identities and deployed migration; no hosted success is claimed by this checkpoint.
