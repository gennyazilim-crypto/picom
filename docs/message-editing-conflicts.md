# Message editing conflict handling

Picom uses compare-and-set RPCs for message edits and deletes. The client sends the `edited_at` version it rendered; PostgreSQL locks the row and rejects stale writes. Direct authenticated `messages UPDATE` access is revoked so clients cannot bypass this contract.

Edits are optimistic. On failure, the visible message rolls back while the inline editor keeps the user's draft open for copy or retry. Deletes validate the same version before hiding the message, avoiding accidental deletion after an unseen edit. A delete is terminal and idempotent.

Realtime and local state retain tombstones. Once a delete is observed, later non-delete events cannot resurrect the message, even when their delivery timestamp is newer. Edited labels use the authoritative database `edited_at` returned by the RPC.

Manual multi-window check:

1. Open one channel in two authenticated desktop windows.
2. Start editing the same message in both.
3. Save window A, then save window B; B must keep its draft and show a conflict.
4. Refresh B, edit again, and confirm the edited indicator matches both windows.
5. Delete in A while B has an edit open; B's save must not restore the message.
6. Confirm moderator delete works and unauthorized users receive no content details.

Automated contracts: `npm run messages:editing-conflicts:smoke`, `npm run realtime:ordering:smoke`, `npm run typecheck`, and `npm run build`. Isolated pgTAP lives at `supabase/tests/rls/message_editing_conflict_handling.sql`.
