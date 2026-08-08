# OBS setup for Picom publisher streams

## Prerequisites

- Publisher account with broadcast permission on Picom Live.
- Stream created with `ingest_mode = OBS_EXTERNAL`.
- LiveKit Ingress deployed (`picom-livekit-ingress`, TCP 1935).
- Feature flags for publisher stream management / external ingest enabled when rolling out.

## One-time credential provision

1. Sign in to Picom and open Creator Studio / stream management.
2. Prepare the stream (`prepare_publisher_stream`) so `room_name` becomes `publisher-stream:{uuid}`.
3. Call edge function `livekit-ingress` with:

```json
{ "action": "provisionForStream", "streamId": "<uuid>" }
```

4. Save the returned values immediately (shown once):
   - **Server** = `url` (RTMP ingest URL, no key)
   - **Stream key** = `streamKey`

Do not paste stream keys into tickets, chat, screenshots, or logs.

## OBS Studio

1. Settings → Stream
2. Service: **Custom...**
3. Server: the `url` from provision (current production shape: `rtmp://23.254.166.240/live` until `ingest.picom.gg` DNS is published)
4. Stream key: the one-time `streamKey`
5. Output: use a stable bitrate matching your uplink (start conservative; raise only if health stays GOOD)
6. Start Streaming

### Protocol / TLS note

Production Ingress currently exposes **plain RTMP on TCP 1935** (UFW allowlisted). RTMPS is not terminated on this VPS yet. Prefer rotating credentials immediately if a key leaks. Do not expose LiveKit admin/API ports publicly.

## Expected Picom states

| OBS | Picom connection | Health |
| --- | --- | --- |
| Idle after provision | WAITING | DISCONNECTED or prior value |
| Connected / publishing | PUBLISHING (via `ingress_started`) | GOOD |
| Stopped | DISCONNECTED (via `ingress_ended`) | DISCONNECTED |

## Troubleshooting

- **Auth failed / cannot connect**: confirm TCP 1935 reachability and that provision succeeded (`provider_ingress_id` present via connection test RPC).
- **Connected but not live**: wait for webhook `ingress_started`; check stream is not `revoked`/`failed`.
- **Lost key**: rotate/provision again; previous key hash is invalidated when replaced.
