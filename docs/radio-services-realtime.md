# Radio Services and Realtime

Radio keeps one canonical catalog in `audioDataSource`. `radioRepository` defines the typed Radio operation contract without creating another state store, and `radioService` remains the component-facing orchestration layer.

## Operations

- list live, draft/scheduled, ended/cancelled sessions
- get session details
- create or update a schedule
- cancel, start, or end a session
- idempotently join or leave listener state
- save or unsave sessions
- react to live/ended sessions
- assign an existing community member as session host/co-host/producer

All operations return typed `AudioServiceResult` errors. Components never call Supabase directly.

## Listener idempotency

`join_current_user_radio_listener` validates authentication, Radio-kind access, live status, and `listenRadio`, then uses the partial active-listener uniqueness index as its atomic conflict target. Reconnects update heartbeat instead of inserting duplicate active listeners. Leave is idempotent and the database listener-count trigger publishes an aggregate session update.

## Realtime lifecycle

`radioRealtimeService` shares one ref-counted channel across all mounted audio hooks. It watches session, listener, reaction, schedule, and host-assignment tables under source-table RLS. Events are bounded-deduplicated and coalesced into a catalog refresh. Channel errors use bounded reconnect delay; unmount clears retry timers, dedupe state, and the Supabase channel.

Mock mode keeps the same repository contract and uses the existing in-memory catalog publisher. Supabase mode relies on RLS-protected Postgres Changes; no service-role credential is present in the renderer.
