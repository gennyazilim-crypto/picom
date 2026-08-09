# Live Recording Architecture

## Provider
Preferred: LiveKit Egress (`livekit/egress`) + S3-compatible FileOutput + Supabase metadata/RLS.

## Current production state (TASK30 seal)
- LiveKit server v1.13.3 + Ingress v1.4.2 + Redis: running on VPS `23.254.166.240`
- LiveKit Egress container: **NOT DEPLOYED**
- VPS: 2 vCPU / 5.8 GiB RAM / no swap — unsafe to co-locate Egress with SFU+Ingress
- Object storage credentials for Egress FileOutput: **NOT CONFIGURED** (`PICOM_RECORDING_S3_*` absent)
- Feature flags: `enableLiveRecording|Replays|Clips` = **OFF** (fail-closed)

## Policy
- MANUAL_RECORD via `publisher_streams.recording_enabled` (default false)
- Global concurrent active recordings capped at **1** (`RECORDING_CAPACITY_EXCEEDED`)
- Recording failure does **not** terminate live stream status

## Lifecycle
REQUESTED → STARTING → RECORDING → STOPPING → PROCESSING → READY | FAILED | CANCELLED | DELETED

## Trust boundary
- Clients call `request_publisher_stream_recording` / Edge `publisher-recording`
- Only service role binds egress id / applies webhook / marks READY
- Clients cannot write `storage_path`, duration, or READY status

## Composition
- PICOM_NATIVE: RoomComposite Egress (when provider available)
- OBS_EXTERNAL: often already composed ingress feed; still RoomComposite by default

## Retention
RETENTION_POLICY_PENDING — no automatic replay deletion worker.
