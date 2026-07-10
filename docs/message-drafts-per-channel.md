# Message Drafts and Cross-Device Sync Policy

Status: local-only production default. Cross-device sync is disabled pending explicit user consent, privacy review, retention rules, and a reviewed encrypted-at-rest backend design.

## Current behavior

- Community drafts use `community:{communityId}:channel:{channelId}`.
- Direct-message drafts use `dm:{conversationId}`.
- Only text up to 4,000 characters is persisted in local client storage.
- Switching channels/conversations restores the scoped draft.
- Successful send clears the exact channel or DM draft.
- Empty drafts are removed; corrupted storage falls back safely.

## Safety boundaries

- No auth tokens, passwords, session data, authorization headers, or credentials are intentionally stored.
- Never sync files, attachment previews, object URLs, image bytes, clipboard contents, or native file paths.
- Attachment previews are not persisted and object URLs are revoked.
- `prepareRemoteSync()` fails closed and contains no Supabase/API write path.

## Future opt-in design

A future setting must default off and explain that draft text is uploaded. Server rows must be user-owned, per-channel/DM keyed, encrypted at rest, retention bounded, excluded from logs/analytics/export diagnostics, and removed on send/logout/account deletion as policy requires. Channel membership must be rechecked before restoring a community draft.

## conflict behavior

If opt-in sync is approved, compare trusted server timestamps. Newer `updatedAt` wins. Equal or invalid timestamps preserve the local draft to avoid silent local data loss. A successful send writes a tombstone/version before remote deletion so an older device cannot restore the sent text. Files are never part of conflict resolution.

## Manual checks

1. Type different drafts in two channels and one DM; switch between them.
2. Send each draft and confirm only that key clears.
3. Attach a file, switch channels, and confirm no attachment returns.
4. Confirm `getSyncPolicy().remoteEnabled` is false and no network request occurs.
