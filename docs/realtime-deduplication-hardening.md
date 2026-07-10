# Realtime event deduplication hardening

Picom applies three bounded duplicate defenses to channel messages:

- insert identity by server message ID;
- optimistic echo identity by `clientMessageId`;
- derived event identity plus semantic ordering for insert/update/delete events.

Each subscription has a monotonically increasing local generation. Event and status callbacks first verify that their generation still owns the active community/channel scope. Cleanup invalidates the generation before asynchronously removing the Supabase channel, so late callbacks from a previous view cannot mutate current state. Message subscriptions run only while `activeView` is `community`.

Diagnostics record only truncated message references, booleans, scope references, status, and aggregate delivered/duplicate/stale counts. They never record message body, attachment data, usernames, auth/session material, or raw client message IDs.

## Required two-window test

1. Open the same channel in two desktop windows using two valid sessions.
2. Send one message rapidly and confirm each window renders one copy only.
3. Disconnect/reconnect one window, then send again; confirm no replay duplicate appears.
4. Edit and delete the same message while both windows are connected; confirm one update/tombstone per window.
5. Switch window B between community, Mention Feed, profile, and back; confirm the old channel produces no late updates.
6. Switch channels rapidly and return; confirm one active listener and no duplicate messages.
7. Inspect redacted logs for subscription lifecycle counters. No duplicate message body or raw client ID may appear.

No duplicate is acceptable by message ID, optimistic `clientMessageId`, or derived event ID. Supabase CLI/backend availability is required for this manual test; static checks cannot claim the two-window run passed.
