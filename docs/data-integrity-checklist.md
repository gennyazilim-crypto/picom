# Restored Data Integrity Checklist

Run read-only by default against an isolated restored staging database.

- Migration history matches the source recovery point.
- Required tables, RLS enablement, policies, functions, triggers, and indexes exist.
- Profiles correspond safely to synthetic Auth users.
- Communities have valid owners, members, default roles, categories, and channels.
- Messages reference valid channels/authors; replies and client message IDs remain consistent.
- Attachment metadata references valid messages and authorized private Storage objects.
- Reactions, read states, follows, mentions, stories, saved items, and events have valid parents.
- DM conversations, participants, messages, attachments, and reactions preserve participant isolation.
- Verification, reports, audit/security records, and release-scoped audio entities retain intentional deletion behavior.
- No private community/channel/DM content becomes public after restore.
- Revoked sessions, invites, tokens, bans, and verification states remain revoked.
- Orphan checks and row-count comparisons are recorded without exposing content.
- Desktop smoke verifies auth, community/channel/message, upload metadata, profile/feed, DM, Realtime, and Edge contracts.

Any mismatch stops promotion. Auto-fix is forbidden without a reviewed change record, backup, owner, test plan, and rollback/forward-fix strategy.
