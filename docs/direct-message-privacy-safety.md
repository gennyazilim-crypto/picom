# Direct Message Privacy and Safety

## User controls

- Direct-message privacy accepts `everyone`, `friends`, or `no_one` and is stored locally in mock mode or in `profiles.dm_privacy` through guarded RPCs in Supabase mode.
- Conversation mute supports one hour, eight hours, 24 hours, or until changed. Mute affects notification delivery only and never changes message access.
- Blocking requires explicit confirmation. It removes friendship, pending friend-request, and follow edges, hides the DM conversation, and prevents message/media access while the block exists.
- Privacy & Safety lists blocked users and provides the recovery path for unblocking.

## Enforcement

- UI checks provide immediate feedback, but Supabase remains authoritative.
- `is_direct_conversation_participant` requires membership and rejects conversations with a blocked participant.
- DM creation, sends, reactions, attachments, shared media, and search inherit participant/block enforcement.
- Friend-request insertion rejects blocked relationships.
- DM message, attachment, reaction, relationship, and report writes are rate limited.

## Reports

- A DM report may target one direct message or the other participant.
- `submit_safety_report` verifies conversation participation and target membership before inserting.
- The report stores the selected target ID and a bounded, redacted reporter description. It never attaches a transcript, unrelated messages, credentials, tokens, or private attachment URLs.
- Reporters may read their own report status. DM report review is limited to Picom app admins; community reports retain community-moderator access.

## Hosted verification

The structural smoke test is safe locally. Live RLS and rate-limit evidence requires a configured Supabase staging project and should be run through the protected hosted validation workflow.
