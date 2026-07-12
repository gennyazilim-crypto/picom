# Meeting Camera Quality and Bandwidth Policy

## LiveKit capabilities used

Picom uses the installed LiveKit Client `2.20.0` APIs rather than a parallel WebRTC stack:

- `adaptiveStream` with background video pausing and controlled pixel density.
- `dynacast` so unused published simulcast layers stop consuming sender CPU/bandwidth.
- camera `simulcast` with explicit `VideoPresets` layers.
- `RemoteTrackPublication.setSubscribed` for hidden or paginated cameras.
- `RemoteTrackPublication.setVideoQuality` for visible tile quality.
- `LocalVideoTrack.setPublishingQuality` when connection quality degrades.

## Presets

| Preset | Capture ceiling | Simulcast layers | Intended impact |
| --- | --- | --- | --- |
| Data Saver | 360p | 180p + 360p | Lowest sender CPU/network use; remote camera requests capped low. |
| Balanced | 720p | 180p + 360p + 720p | Default; suitable for normal desktop meetings. |
| High Quality | 1080p | 360p + 720p + 1080p | Higher CPU/network cost; connection policy can still cap it. |

The default is Balanced. A poor local connection caps publishing and visible remote video at low quality; a good connection caps focus video at medium. Audio subscriptions are handled separately and are never reduced by this camera policy.

## Layout and visibility

- Focus tiles request high quality when bandwidth permits.
- Standard tiles request medium quality.
- Filmstrip, large-grid, and overflow tiles request low quality.
- Cameras outside the current page/filmstrip are unsubscribed.
- Stage mode includes only host/cohost/speaker camera tracks; audience cameras are not requested.
- LiveKit adaptive stream may additionally pause tracks whose attached elements are not visible.

## Evidence limits

Static contracts, typecheck, production build, and renderer performance budgets run locally. Hosted multi-client bandwidth shaping and native Windows/Linux/macOS CPU measurements remain **BLOCKED** until provider credentials, network shaping, and platform runners are available.
