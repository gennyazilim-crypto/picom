# Publisher stream management architecture (TASK27)

## Scope

Extends Live Now / Go Live. Does **not** replace `community_live_screen_sessions` discovery.

| Path | Ingest | Room |
| --- | --- | --- |
| PICOM_NATIVE | WebRTC via existing Go Live + `livekit-token` | existing community / live session rooms |
| OBS_EXTERNAL | RTMP (LiveKit Ingress) | `publisher-stream:{streamId}` |

## Data

- `publisher_streams` — lifecycle, connection_state, health_status, room_name
- `publisher_stream_credentials` — hashed secrets, ingest_url, provider_ingress_id
- `publisher_stream_audit_events` — append-only, no secrets
- RPCs: create/prepare/transition, credential create/rotate/revoke/test
- Service RPC: `service_apply_publisher_stream_ingress_event`

## Edge

| Function | Role |
| --- | --- |
| `livekit-ingress` | Owner/service auth; Create/Delete/List Ingress; bind hashed LiveKit key; return plaintext once |
| `livekit-webhook` | Meeting path unchanged; for `publisher-stream:*`, handle `ingress_started` / `ingress_ended` |
| `livekit-token` | Native voice/video/screen only (unchanged in this task) |

## VPS

- Existing: `picom-livekit` + `picom-livekit-redis` (host network), public `wss://voice.picom.gg`
- Add: `picom-livekit-ingress` (`livekit/ingress:v1.4.2`), host network
  - `ingress.yaml`: redis `127.0.0.1:6379`, `ws_url ws://127.0.0.1:7880`, `rtmp_port 1935`, `whip_port 8085`
  - `livekit.yaml` `ingress.rtmp_base_url` / `whip_base_url` (restart livekit only if newly added)
- Scripts: `scripts/deploy-livekit-ingress.ps1`, `scripts/livekit-ingress-preflight.mjs`

## Security invariants

- Hash-only credential storage
- One-time plaintext reveal from edge
- No secret logging
- Webhook signature verification retained; publisher ingress events mapped without echoing stream keys
