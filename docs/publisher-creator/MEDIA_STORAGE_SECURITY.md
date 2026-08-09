# Media Storage Security

## Bucket
`publisher-stream-recordings` — private Supabase Storage bucket (3 GiB object limit for controlled rollout).

## Access
- No authenticated INSERT/UPDATE/DELETE policies on this bucket
- Service role / Edge only for object IO
- Playback via Edge signed URL after RPC authorization

## Path model
`publishers/{publisher_id}/streams/{stream_id}/recordings/{recording_id}/...`
`publishers/{publisher_id}/clips/{clip_id}/...`

## Integrity
Prefer provider size/ETag when available; optional checksum column. Avoid re-hashing multi-GB repeatedly.

## CDN
No `cdn.picom.gg` / `media.picom.gg` deployed. Direct signed object playback for controlled beta when infra ready.

## Secrets
Never return LiveKit API secret, S3 secret, service role, or long-lived signed URLs to clients.
