# Picom LiveKit Production Smoke Test

Run this test on an approved production-like environment with synthetic accounts A and B. Record app version, commit, platform, LiveKit region, Supabase project/environment label, tester, date, and redacted result.

## Preconditions

- Exact desktop candidate passed typecheck/build/native package smoke.
- Production-like Supabase migrations/RLS are current.
- `livekit-token` is deployed with JWT verification and server-only secrets.
- A and B are permitted members of the same voice channel.
- Microphone/screen capture permissions can be tested without exposing private content.
- Use a synthetic screen/window with no personal or secret data.

## Token and denial checks

- [ ] Missing JWT is rejected.
- [ ] Invalid/expired JWT is rejected without echoing token data.
- [ ] Unauthorized account/channel is rejected.
- [ ] Text channel and mismatched room name are rejected.
- [ ] A/B token identity equals the respective Supabase user ID.
- [ ] Room is `community:{communityId}:voice:{channelId}`.
- [ ] Expiry is approximately one hour and token is room-scoped.

## Required two-user voice flow

1. A opens the voice channel and joins.
2. B joins the same channel from a second desktop client/window.
3. Both participant rows appear once with correct display names.
4. A speaks; B sees A’s speaking indicator and hears audio.
5. B speaks; A sees B’s speaking indicator and hears audio.
6. A mutes; remote audio from A stops and both clients show muted state.
7. A unmutes; audio/speaking state resumes.
8. B deafens; B hears no remote audio while room/participant state remains connected.
9. B undeafens; remote audio resumes.
10. Deny/remove a microphone permission/device where safe; client remains connected muted with a clear error.

## Required screen-share flow

1. A selects **Choose source**; source enumeration starts only after the click.
2. Verify source list/thumbnails are sanitized preload DTOs and are not logged.
3. A selects the synthetic source and starts sharing.
4. A sees a muted local preview.
5. B sees the remote screen-share track and the correct sharer.
6. Voice mute/deafen/speaking controls remain responsive during sharing.
7. A stops sharing; both previews disappear and capture track stops.
8. Repeat by stopping from OS capture UI if supported; Picom cleans up state.
9. Deny screen permission and verify safe error/no crash.

## Leave and cleanup

1. B leaves; A no longer sees B and no stale speaking state remains.
2. A starts sharing, then leaves; local audio/screen tracks stop and B’s remote viewer clears.
3. Rejoin A; participant, mute, deafen, speaking, and share state starts clean.
4. Switch voice channels and verify the previous room disconnects.
5. Close the window/app and verify provider room participants disappear within expected timeout.

## Network recovery

- [ ] Briefly disconnect/reconnect A’s network; UI shows reconnecting and avoids duplicate participants.
- [ ] Verify mute/deafen/share state is safe after reconnect.
- [ ] Test one constrained network/TURN fallback path if provider tooling allows.
- [ ] Core text chat remains usable if LiveKit is unavailable.

## Platform matrix

| Platform | Microphone | Speaking | Mute/deafen | Source picker | Remote share | Permission recovery | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Windows | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Linux X11 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Linux Wayland | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| macOS | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |

## Privacy/log inspection

- [ ] No LiveKit JWT/API secret/service-role key is present in renderer logs or diagnostics.
- [ ] No source thumbnail/frame, audio sample, device ID, IP address, or private content is logged.
- [ ] User-facing errors omit provider stack traces and raw server responses.

## Result

- [ ] Pass
- [ ] Fail
- [ ] Blocked by provider/OS environment

Any unauthorized token, private source exposure, lingering capture after leave, or secret in logs is a release blocker.
