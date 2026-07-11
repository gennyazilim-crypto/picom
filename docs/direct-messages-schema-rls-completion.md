# Direct Messages schema and RLS completion

## One-to-one identity

Active direct conversations now store a normalized participant pair with a partial unique index. `create_direct_conversation` serializes the pair with an advisory transaction lock and returns the canonical row. Pre-existing duplicate rows are retained for audit/retention, marked `superseded_by`, archived for both participants, excluded from normal lists, and blocked from new activity.

## Message lifecycle

- `client_message_id` is non-empty, bounded, and unique per author for idempotent retry reconciliation.
- Replies are inserted atomically by `send_direct_message_v2`, must point into the same conversation, and become immutable.
- Conversation, author, creation time, and client identity are immutable.
- Authors may edit active messages; the database owns `edited_at` and rejects edits after a block or deletion.
- Delete is a one-way soft delete that redacts the body. Direct hard delete is revoked from authenticated clients.
- Participant read state includes both `last_read_at` and a precise `last_read_message_id` cursor.
- Mute/archive preferences update only the authenticated participant row through an RPC.

## Attachments, reactions, and Storage

Reactions can be added only by a participant who may currently send and only to active messages; users may still remove their own reaction. Attachment metadata is insertable only by the author of the active message, and the uploader is assigned/validated by the database.

The private `direct-message-attachments` bucket uses the path contract:

`<conversation-id>/<message-id>/<uploader-id>/<file-name>`

Storage SELECT requires current conversation participation and an active matching message. INSERT requires the authenticated uploader to own the message and retain send permission. UPDATE/DELETE remain uploader-owned and participant-bound. Signed URLs and credentials are never persisted in metadata.

## Privacy boundary

Conversation metadata, participants, messages, attachment metadata, reactions, and objects remain participant-only under RLS. Bilateral global blocks and participant block state prevent all new send, edit, reaction, and attachment activity while preserving read/removal/soft-delete safety operations.

Hosted pgTAP fixtures cover participant/outsider access, idempotent retries, reply boundaries, own edit/soft delete, reactions, preferences, and read state. They require an isolated Supabase test environment; static validation does not claim hosted execution.
