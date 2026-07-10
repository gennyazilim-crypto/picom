# Task 190 Checkpoint: Blocking and Privacy Enforcement

- Activated the existing collapsed blocked-message presentation by passing block state into ChatMain.
- Excluded blocked authors from Mention Feed and followed stories.
- Added atomic, rate-limited block/unblock RPCs that remove friendship, request, and follow edges.
- Revoked direct renderer writes to `blocked_users` and added a safe remote block-list RPC.
- Updated Privacy & Safety copy and unblock behavior to use the centralized production service.
- Confirmed DM and friend-request backend paths recheck bidirectional blocks.

Validation: `npm run blocking:privacy:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
