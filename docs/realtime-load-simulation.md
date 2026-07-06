# Realtime Load Simulation

Picom includes a safe development-only realtime load simulation script for exercising message, typing, presence, disconnect, reconnect, and duplicate-event paths without targeting production.

## Command

```bash
npm run realtime:load:simulate
```

Default behavior:

- in-memory dry run
- no Supabase connection
- no production traffic
- 5 simulated clients
- 3 messages per client
- typing start/stop events
- presence online/offline updates
- disconnect/reconnect placeholder events
- duplicate event prevention check

## Options

```bash
npm run realtime:load:simulate -- --clients=10 --messages=5 --delayMs=25 --communityId=local-community --channelId=general
```

Supported options:

- `--clients=5`
- `--messages=3`
- `--delayMs=10`
- `--communityId=mock-community-load-test`
- `--channelId=mock-channel-general`
- `--reconnectEvery=3`

Safety limits:

- clients must be between 1 and 250
- messages per client must be between 0 and 250
- delay must be between 0 and 5000 ms
- production mode is blocked by default
- remote execution is blocked unless `PICOM_REALTIME_LOAD_ALLOW_REMOTE=true`

## Simulated flows

The script simulates:

- connecting users
- joining community/channel rooms
- joining typing and presence rooms
- sending messages
- typing start and typing stop events
- presence updates
- disconnect/reconnect cycles
- duplicate event checks using event ids

## Not included yet

- real Supabase Realtime channel publishing
- authenticated staging users
- RLS validation
- load generation against production
- persistent message writes

Those require a controlled staging test plan and explicit credentials. Do not run broad realtime load tests against production by default.

## Manual test steps

1. Run `npm run realtime:load:simulate`.
2. Confirm the output mode is `dry_run_in_memory`.
3. Confirm `messageEvents` equals `clients * messagesPerClient`.
4. Confirm `duplicateEventsPrevented` is greater than zero.
5. Run with a custom channel id and confirm it appears in sample events.
6. Try `--execute` without `PICOM_REALTIME_LOAD_ALLOW_REMOTE=true` and confirm it fails safely.

