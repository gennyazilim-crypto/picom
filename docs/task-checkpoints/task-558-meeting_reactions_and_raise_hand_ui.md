# Task 558 checkpoint - Meeting reactions and raise-hand UI

- Centralized the approved Picom meeting reaction catalog and rendered expiring sender overlays on participant tiles.
- Added restrained motion with a reduced-motion static fallback and accessible reaction labels.
- Preserved transport burst protection while adding visible client cooldown feedback.
- Made the dock hand action stage-aware for request-to-speak and cancellation.
- Added a sequence-ordered raised-hand queue, host acknowledgement, and non-disruptive participant-row markers.
- Reused the Task 540 Realtime/RLS lifecycle, including stale-hand cleanup after leave or removal.

Hosted cross-client evidence remains BLOCKED until configured Supabase and LiveKit staging credentials are available. Local contract, typecheck, mock, build, performance, and QA validation are required before commit.
