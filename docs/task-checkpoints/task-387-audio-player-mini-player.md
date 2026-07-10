# Task 387 Checkpoint: Audio Player and Mini Player

## Result

Added reusable desktop AudioPlayer and AudioMiniPlayer components with explicit
playback, progress, duration, volume, mute, cover, title, and context controls.

## Behavior

- A real `HTMLAudioElement` is created only after the user selects Play.
- Mock items without an audio URL use bounded simulated progress.
- Pause, seek, volume, mute, stop, source change, and unmount cleanup are covered.
- No autoplay, Supabase Storage, LiveKit, or external media dependency was added.
- Coolicons/AppIcon now provides consistent play/pause/volume glyphs.

## Integration boundary

The player is reusable but not yet mounted in Feed/Profile/Community; those
connections are handled by the following tasks.
