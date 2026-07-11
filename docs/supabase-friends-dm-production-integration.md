# Supabase Friends and Direct Messages Production Integration

## Friends

Friend requests, accept/decline/cancel, removal, blocking, suggestions, notifications, and presence stay behind the friend service and guarded RPCs. RLS limits relationship rows to their participants, block state is authoritative, and all Realtime channels are removed during cleanup.

## Direct Messages

Conversation create/open/list, cursor-paginated messages, replies, edits, soft deletes, reactions, precise read state, preferences, shared media, private typing, and Realtime reconciliation use the Direct Message service/repository layer. Components do not query Supabase.

`send_direct_message_v3` derives the author from `auth.uid()`, rejects blocked/non-participant sends, validates same-conversation replies, and treats conversation, body, reply target, and attachments as one idempotent payload. A reused client key with different content fails closed. Validated private attachment metadata commits in the same transaction as the message.

The private Storage path is `conversationId/attachmentId/uploaderId/fileName`. Pending upload access requires the authenticated participant and committed reads require attachment metadata joined to a participant-visible message. Signed URLs remain short-lived and no public bucket is introduced.

## Evidence boundary

Local contracts cover service routing, RLS shape, block/privacy enforcement, optimistic deduplication, Storage path alignment, Realtime publication, and cleanup. Real two-client friend/DM propagation, hosted block revocation, and signed attachment upload/read denial remain **BLOCKED** without Supabase CLI or protected staging accounts. No hosted PASS is claimed.
