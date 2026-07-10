# Advanced Presence Accuracy

## Behavior

- Tray `invisible` maps to presence `offline` and the Supabase presence channel is untracked; invisible users are never converted back to online.
- Remote `offline`, malformed, unreasonably future-dated and older-than-90-second presence entries are excluded.
- Multiple sessions under one user key are aggregated; the freshest visible session wins while an invisible session does not hide another genuinely visible session.
- A visible/online desktop refreshes `lastSeen` every 30 seconds.
- The same interval prunes stale remote entries even when no Supabase sync event arrives.
- Browser offline immediately marks the connection disconnected and clears online presence; online/focus/visibility/native resume paths retrack with a fresh timestamp.
- Community/user/channel changes clear pending timers, untrack and remove the old channel.

## Privacy

- Presence contains only user ID needed for authorized aggregation, bounded display name/avatar URL, coarse status and last-seen timestamp.
- No message/voice content, active channel, typing text, device fingerprint, IP or exact activity history is included.
- Invisible is a privacy choice and must be enforced server/client side; UI labels are not sufficient.
- Production member visibility still depends on community membership/RLS and public member-list policy.

## Multi-session policy

- Any fresh visible session may make the account visible.
- `offline`/invisible sessions contribute no public presence.
- Freshest visible session determines coarse online/idle/DND display.
- Session revocation must disconnect its realtime socket; stale cutoff is defense in depth, not revocation enforcement.

## Manual checklist

1. Open two authenticated windows in one community; verify one user row, not duplicates.
2. Set one session idle/DND and verify newest visible state wins.
3. Set all sessions invisible and verify the user disappears/offline after sync.
4. Keep one session online and another invisible; verify the online session remains visible.
5. Sleep longer than 90 seconds, wake and verify reconnect/retrack without stale users.
6. Disable network and verify remote online state clears; reconnect and verify fresh state.
7. Switch communities repeatedly and confirm no duplicate channel/timer/listener updates.
8. Revoke a session and confirm its socket disconnects in hosted Supabase tests.

## Production gaps

- Hosted multi-client/revocation/clock-skew tests are required.
- Supabase Presence is ephemeral; durable last-seen/offline history is intentionally not implemented.
- Backend member-list/RLS and bidirectional block/invisible policies require adversarial testing.
