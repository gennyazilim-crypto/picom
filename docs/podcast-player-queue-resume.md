# Podcast player, queue, and resume

Picom uses one global audio transport for Podcast episodes and live Radio. Selecting one audio source replaces the previous source, and switching away from Radio first completes the Radio listener-leave operation. Components never create their own `Audio` instance.

## Podcast controls

- Play and pause are always initiated by the user; selecting an episode never autoplays it.
- Seek exposes elapsed and duration values through the accessible range control.
- Volume and mute remain shared across Radio and Podcast and volume is stored locally.
- Podcast speed supports 0.75x, 1x, 1.25x, 1.5x, and 2x. The preference is reused for the next Podcast episode but never changes live Radio speed.
- Previous restarts the current episode after five seconds, otherwise it selects the previous accessible episode.
- Next selects the next accessible published episode.
- Queue navigation continues playback only when the current episode was already playing. A paused or newly selected queue item remains paused.
- Closing the global mini player persists progress and releases the transport.

## Queue safety

The coordinator builds the queue from Podcast episodes visible through the audio data source. Only published episodes with an authorized signed audio URL enter the automatic queue. The current visible item remains usable as a one-item fallback if the catalog request fails. Radio always uses a one-item queue.

## Resume behavior

Progress is saved approximately every ten seconds and on pause, item change, stop, close, completion, and desktop unload. Mock mode stores progress under the current mock user. Supabase mode upserts `podcast_playback_progress` under the authenticated user and relies on RLS from the Podcast data-model migration.

Selecting an episode loads progress before the first user-initiated play. Completed episodes restart from zero; unfinished episodes resume unless their saved position is within five seconds of the end. A progress persistence failure does not destroy playback and is exposed as a non-blocking player status.

## Unavailable content

If a selected episode disappears from the authorized catalog, is unpublished, loses its private signed source, or returns a media error, Picom stops the shared transport and shows an unavailable/private error. It does not fall through to an untrusted URL or expose Storage paths.

## Keyboard and accessibility

When the mini player itself has focus:

- `Space`: play or pause
- `Left Arrow`: seek back 15 seconds
- `Right Arrow`: seek forward 15 seconds
- `M`: mute or unmute

All transport, queue, speed, volume, seek, and close controls have explicit accessible labels and visible focus states.
