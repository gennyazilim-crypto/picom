# Radio and Podcast MVP QA

## Automated Evidence

The audio QA suite covers:

- Domain types and minimum mock catalog coverage.
- Explicit-action Audio Player and Mini Player behavior.
- Mention Feed radio/podcast integration.
- Profile hosted, published, and saved audio sections.
- Community Audio tabs and role-aware entry points.
- Radio Panel local listener controls.
- Podcast detail, comments preview, reactions, and related episodes.
- Mock/Supabase service separation.
- RLS presence and private storage bucket configuration.
- Prohibited branding, external mock audio, autoplay, and unsafe HTML checks.

Run:

```powershell
npm run audio:mvp:qa
npm run audio:service:smoke
npm run audio:schema:smoke
npm run audio:podcast:smoke
npm run audio:radio:smoke
npm run audio:community:smoke
npm run audio:profile:smoke
npm run audio:feed:smoke
npm run audio:player:smoke
npm run audio:domain:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

## Manual Desktop Matrix

Use mock mode at 1440x900 in both light and dark themes:

1. Open Mention Feed and confirm radio/podcast cards remain inside the feed grid.
2. Open a podcast episode, press Play in the mini player, seek, change volume, and close it.
3. Open a live radio card, start/stop local listening, mute, change volume, save, and leave.
4. Open a community, select Audio, and switch Live Radio, Podcasts, and Scheduled tabs.
5. Open Radio Panel and confirm host tools appear only for a permitted mock role.
6. Open Podcast Detail from Community Audio and from Profile audio sections.
7. Toggle local save and reaction state, then confirm related episode navigation.
8. Return to a text channel and send a mock message.
9. Open a voice channel and confirm the existing Voice Room UI still renders.
10. Maximize/restore the Electron window and confirm no horizontal overflow.

## Intentional Production Gaps

- The migration has not been applied to local/staging in this environment because Supabase CLI is unavailable.
- Live radio transport is not connected to LiveKit; host broadcast actions are explicit placeholders.
- Podcast upload, transcoding, waveform, signed URL refresh, and storage scanning are not connected.
- Realtime listener counts and radio lifecycle broadcasts are not connected.
- Mock podcast items intentionally omit copyrighted audio and use simulated playback when no URL exists.
- Generated database placeholder types must be refreshed with `npm run supabase:types` after the migration is applied.

These are production integration tasks, not hidden failures in the mock MVP.
