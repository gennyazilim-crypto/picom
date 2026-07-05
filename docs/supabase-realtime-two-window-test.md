# Supabase Realtime two-window test

Task 194 defines the manual two-window verification flow for Picom's Supabase Realtime message foundation.

## Goal

Confirm that two running Picom desktop windows can receive message changes for the same active community/channel without refresh, duplicate optimistic messages, or cross-channel leakage.

This is a manual release-smoke test. It verifies the renderer realtime hooks, Supabase publication setup, RLS boundaries, typing broadcast, presence sync, unread foundation, and reconnect status in the premium desktop shell.

## Required environment

- Local or staging Supabase project.
- Applied Supabase migrations.
- Seeded development users.
- Picom running with:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Do not use service-role keys in the Electron renderer.

Useful local commands:

```powershell
npm run typecheck
npm run build
npm run supabase:smoke
npm run electron:dev
```

If `supabase:smoke` reports that the Supabase CLI is missing, install/configure the CLI before treating this realtime test as complete.

## Realtime channel naming

The current renderer realtime foundations use these names:

- Messages: `room:community:{communityId}:channel:{channelId}`
- Presence: `presence:community:{communityId}`
- Typing: `typing:community:{communityId}:channel:{channelId}`

Only the active community/channel should be subscribed for message and typing events. Presence is scoped to the active community.

## Required Supabase SQL

Realtime for messages is enabled by:

```sql
alter publication supabase_realtime add table public.messages;
```

The committed migration uses an idempotent guard:

```text
supabase/migrations/20260704002400_enable_messages_realtime.sql
```

## RLS and security expectations

- The client uses the Supabase anon key plus the signed-in user's session.
- Message visibility remains controlled by `public.messages` RLS policies.
- Channel visibility remains controlled by channel/community membership policies.
- Private or unrelated channel messages must not appear through realtime subscriptions.
- Do not test with disabled RLS unless the goal is a local-only database troubleshooting session.
- The anon key is acceptable in the renderer only with RLS enabled and verified.
- Never paste service-role keys, database passwords, LiveKit secrets, or signing keys into `.env.local`.

## Test setup

1. Start local Supabase or open the staging Supabase project.
2. Apply migrations and seed data.
3. Start Picom in Supabase mode.
4. Open two Picom desktop windows.
5. Sign in with two seeded users, or the same user in both windows if multi-user seed access is not ready.
6. Select the same community and text channel in both windows.
7. Confirm both windows show `Live` or recover to `Live` in the ChatHeader realtime pill.

## Test cases

### 1. New message broadcast

1. In window A, send a short text message.
2. Confirm window A shows the optimistic message immediately.
3. Confirm window B receives the message without refresh.
4. Confirm neither window shows a duplicate message after server confirmation.
5. Confirm the message has a single stable row after waiting at least 5 seconds.

### 2. Channel isolation

1. Keep window A in channel 1.
2. Switch window B to channel 2.
3. Send a message in channel 1 from window A.
4. Confirm window B does not append the channel 1 message while it is viewing channel 2.
5. Confirm window B may show unread/mention state for the inactive channel when the foundation receives an inactive-channel event.

### 3. Typing broadcast

1. In window A, focus the composer and type without sending.
2. Confirm window B shows a compact typing indicator under the message list.
3. Confirm window A does not show itself as typing.
4. Stop typing or blur the composer.
5. Confirm the typing indicator disappears after the short timeout.

### 4. Presence sync

1. Keep both windows in the same community.
2. Confirm the member sidebar presence dots update for signed-in users.
3. Confirm the current user does not require a full app refresh to appear online in the other window.
4. Switch one window to another community and confirm presence is scoped to the active community.

### 5. Update/delete propagation

1. Edit or delete a message where the UI flow is currently available.
2. Confirm the second window reflects the update/delete after realtime delivers the row change.
3. If edit/delete is not enabled for the selected account, mark this test as blocked by permissions rather than failed.

### 6. Reconnect smoke test

1. Disconnect the network or pause the Supabase realtime connection temporarily.
2. Restore the connection.
3. Confirm the ChatHeader status returns to connected/reconnected state.
4. Send another message and confirm it arrives in both windows.

## Expected result

- Messages appear in the active channel across both windows.
- Duplicates are prevented by message id and `clientMessageId`.
- Channel switching does not leak unrelated channel messages.
- Reconnect does not require restarting the app.
- Errors show toast feedback instead of crashing the renderer.
- Typing and presence subscriptions clean up on channel/community switch.
- The native Electron menu/titlebar remains hidden; the custom Picom titlebar remains usable during the test.

## Known limitations

- This document is a manual test runbook; it does not launch two Electron windows automatically.
- Supabase Realtime behavior depends on local/staging Supabase project configuration.
- Private channel coverage should be re-tested whenever private channel policies are expanded.

## Result record template

```text
Date:
Tester:
Environment:
Commit:
Supabase project:
Users tested:
Message broadcast: pass/fail
No duplicates: pass/fail
Channel isolation: pass/fail
Typing broadcast: pass/fail
Presence sync: pass/fail
Reconnect: pass/fail
Notes:
```
