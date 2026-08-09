# Media Operations Runbook

## Preflight before enabling flags
1. Confirm separate host or upgraded CPU for LiveKit Egress
2. Set `PICOM_LIVEKIT_EGRESS_ENABLED=true`
3. Configure `PICOM_RECORDING_S3_*` (endpoint, bucket, access, secret, region)
4. Deploy egress with pinned image compatible with livekit-server v1.13.x
5. Deploy `publisher-recording` + updated `livekit-webhook`
6. Deploy `publisher-media-worker` with ffmpeg
7. Internal synthetic pipeline smoke
8. Only then consider scoped internal flag enablement

## Concurrency
Fail closed at 1 global active recording on current capacity model.

## Failure
Recording FAILED leaves stream LIVE. Publisher sees warning; no auto end broadcast.

## Cleanup
Only temp/failed processing artifacts. Replay retention: RETENTION_POLICY_PENDING.

## Do not
- Deploy Egress on the 2-vCPU SFU host without capacity upgrade
- Enable public flags without playback/clip certification
- Record real public content for smoke tests
