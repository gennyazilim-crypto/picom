# Stream credential security (TASK27)

## Model

OBS/external ingest credentials live in `publisher_stream_credentials`.

- Plaintext stream keys are **never** persisted.
- DB stores `secret_hash` = SHA-256 hex of the raw secret (`publisher_stream_hash_secret`).
- Clients may see plaintext **once** at create/rotate/provision time (`revealed_once`).
- Audit metadata must never include `stream_key`, `plaintext_secret`, or `secret`.

## LiveKit Ingress source of truth

For production OBS ingest, the LiveKit Ingress stream key is the OBS stream key:

1. Edge `livekit-ingress` action `create` / `provisionForStream` creates an RTMP Ingress.
2. Service role updates the active credential row with:
   - hash of the LiveKit `streamKey`
   - `ingest_url` (server URL only)
   - `provider_ingress_id`
   - `provider_room_name` = `publisher-stream:{streamId}`
3. Response returns `{ ingressId, url, streamKey }` once to the authenticated stream owner (or service-role caller).
4. Subsequent `get` never re-emits `streamKey`.

Optional preparatory RPC `create_publisher_stream_credential` may still create a Picom-random key; provisioning replaces that hash with the LiveKit key hash.

## Access control

- Authenticated Bearer user JWT (anon client + `getUser`) and owner check.
- Service-role Bearer accepted for internal ops.
- Credentials table: FORCE RLS, no authenticated SELECT (hash is not client-readable).
- Edge must not log stream keys, API secrets, or full ingress webhook payloads that include secrets.

## Rotation / revoke

- Rotate: create a new Ingress (or rotate RPC then re-provision), mark previous credential `rotated`.
- Revoke: delete Ingress, clear `provider_ingress_id`, mark credential `revoked`, set connection `REVOKED` / `DISCONNECTED` as applicable.
