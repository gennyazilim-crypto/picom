# Clip Processing

## Scope
Publisher-only clips from own replays. Viewer clips: future.

## Limits
- `0 <= start_ms < end_ms`
- `end_ms <= replay.duration_ms` when known
- Max duration: **60 seconds**

## Pipeline
REQUESTED → media job CLIP_EXTRACT (SKIP LOCKED) → PROCESSING → READY | FAILED

## Security
- No client-supplied storage paths
- No shell interpolation of titles/paths into FFmpeg
- Worker fails closed until `PICOM_FFMPEG_PATH` + storage fetch are configured

## Copyright
AUTOMATED_COPYRIGHT_MATCHING: NOT_IMPLEMENTED  
Report path: reuse existing report taxonomy (hook); no Content ID.
