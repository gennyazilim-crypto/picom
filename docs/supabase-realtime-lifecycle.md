# Supabase Realtime Lifecycle

Picom uses canonical topic builders for active community messages, community-wide unread inserts, community presence and typing, participant-only DM typing, DM data/list updates, Feed invalidation, friend presence, Radio, and Podcast catalogs.

## Authorization

Private topics are deny-by-default through `realtime.messages` RLS. Community presence requires membership. Channel typing and room topics require membership plus channel visibility; private channels use the mature multi-role `viewPrivateChannels` permission including category/channel overrides. DM typing requires an active, unblocked conversation participant. Unknown topics, malformed subjects, and mismatched community/channel IDs are denied.

Postgres Changes remain protected by their source-table RLS. A Realtime event is never an authorization grant and services refetch authoritative state where required.

## Session and reconnect

The Supabase client persists sessions and auto-refreshes tokens. `TOKEN_REFRESHED`, sign-in, initial-session, and user-update events synchronize the private Realtime authorization token without logging it. Sign-out removes all channels. Feature services map reconnect states, use generation guards/dedupers, and remove channels during scope changes.

## Presence and typing

Typing sends are throttled, expire locally, reject out-of-order events, broadcast an explicit stop during cleanup, and subscribe only to the active channel/conversation. Presence uses private community topics, heartbeat/pruning, `untrack`, and channel removal. Friend-presence cleanup waits briefly before publishing offline so an immediate replacement subscription cannot be overwritten by a stale cleanup RPC.

## Diagnostics

`realtimeDiagnosticsService` reads the actual Supabase channel registry and reports counts by feature, duplicate count, and a bounded health flag. It never returns topic strings, user IDs, JWTs, sessions, or message payloads.

Hosted two-client verification remains gated by the staging-only runner. It must prove exact-once message/typing delivery, reconnect recovery, presence sync, and zero channels after cleanup.
