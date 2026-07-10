# Direct Messages schema and RLS

Picom Direct Messages are private, participant-scoped data. The foundation is defined by `20260710248000_direct_messages_schema_rls_foundation.sql` and is consumed through the service layer. React components must not query these tables directly.

## Canonical tables

- `direct_conversations` stores private conversation metadata and `last_message_at`.
- `direct_conversation_participants` stores membership, read state, mute/archive state, and conversation-local blocking state.
- `direct_messages` stores nullable text, replies, client-message deduplication, edit state, and soft-delete state.
- `direct_message_attachments` stores safe attachment metadata. `url` is a storage object key or authorized URL, never a local path or embedded credential.
- `direct_message_reactions` stores one row per message, user, and emoji.

The migration renames the earlier `direct_conversation_members` table instead of creating a second membership source of truth. Existing IDs and relationships are preserved.

## Access boundary

RLS is enabled on every Direct Messages table.

- Conversation metadata is visible only to participants.
- Participant rows are visible only within a conversation the requester participates in.
- Messages, attachments, and reactions inherit the same participant boundary.
- A participant may send only as their authenticated profile and only while the conversation is not blocked.
- Message authors may update or delete only their own messages.
- Participants may add reactions as themselves and remove only their own reactions.
- Muting or archiving changes presentation only and never grants access.
- Anonymous users and non-participants receive no Direct Messages table access.

Global search and Mention Feed do not query Direct Messages tables. Future DM-specific search must remain participant-scoped and RLS-backed.

## Attachment privacy

Database RLS protects attachment metadata. Storage policies and signed URL generation must independently verify conversation participation before returning bytes. Public buckets must not be used for private DM files.

## Validation

```powershell
npm run dm:schema:rls:smoke
npm run supabase:smoke
npm run supabase:rls:smoke
```

When Supabase CLI and Docker are available, run `npm run supabase:rls:test` for live pgTAP policy verification.
