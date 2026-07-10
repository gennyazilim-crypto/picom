# LiveKit Production Quality Monitoring

## Objective

Make Picom voice and screen sharing observable without logging tokens, room credentials, private conversation content, raw device labels, or media.

## Standard states and errors

Connection states:

- `idle`
- `requesting_token`
- `connecting`
- `connected`
- `reconnecting`
- `permission_denied`
- `token_error`
- `error`
- `disconnected`

Stable service codes:

| Code | User copy | Operator interpretation |
| --- | --- | --- |
| `VOICE_NOT_CONFIGURED` | Voice is not available in this environment. | Missing/disabled trusted provider configuration |
| `VOICE_TOKEN_FAILED` | Picom could not authorize this voice session. Try again. | Edge Function/auth/permission/token failure |
| `VOICE_CONNECTION_FAILED` | Picom could not connect to this voice room. Check your network and try again. | LiveKit/WebRTC transport or endpoint failure |
| `VOICE_ROOM_UNAVAILABLE` | Join a voice room before using this control. | Invalid local action state |
| `VOICE_PERMISSION_DENIED` | Microphone or screen recording permission was denied. | OS/browser permission or missing input |
| `VOICE_SCREEN_SHARE_FAILED` | Picom could not start or stop screen sharing. | Desktop capture, publish, or unpublish failure |

SDK exception messages are not shown directly to users. Redacted diagnostics record code/state and safe error class only.

## Current diagnostics summary

`voiceService.getDiagnosticsSummary()` returns status, connected state, participant count, mute/deafen state, screen-sharing state, remote-share count, and the last standardized error code.

It intentionally excludes room name, participant identity/name, token, LiveKit URL, device labels, track IDs, media, and raw error messages.

## Quality signals

### Connection

- join attempts/success/failure by app version/platform/release channel
- token request duration/failure code
- time from join click to connected
- reconnect count and reconnect duration
- disconnect reason category
- session duration and clean leave rate

### Audio

- microphone permission denied/unavailable count
- mute/unmute command failure count
- participant publication/subscription state mismatch
- speaking indicator transitions versus active-speaker events
- no-audio support reports by platform/audio stack

Do not capture audio samples or device names by default.

### Screen share

- source picker unavailable/canceled/failed
- OS screen-recording permission denied
- capture start duration
- publish/unpublish failure
- unexpected track end
- share duration and clean stop rate

Do not capture thumbnails, frames, window titles, source IDs, or shared content in telemetry.

## Speaking indicator accuracy

1. Local microphone speech toggles the remote active-speaker indicator.
2. Mute removes speaking state promptly.
3. Reconnect clears stale speaking identities.
4. Participant disconnect removes the indicator and row state.
5. Background noise does not leave the indicator permanently active.

Record only pass/fail timing observations, never audio.

## Platform failure matrix

### Windows

- Microphone privacy disabled/enabled.
- Default device removed while connected.
- Screen capture monitor/window and protected-content failure.
- Network adapter change and sleep/wake reconnect.

### Linux

- PipeWire/PulseAudio input availability.
- X11 and Wayland portal screen capture.
- Missing/denied xdg-desktop-portal.
- Device/session changes during a room.

### macOS

- Microphone permission prompt/deny/grant.
- Screen Recording deny/grant/restart behavior.
- Window/screen picker and relaunch after permission change.
- Sleep/wake and network handoff.

## Client logs

Allowed:

- app version, platform, release channel
- standardized voice status/error code
- operation category
- duration/participant-count bucket and retry count
- safe error class/name

Forbidden:

- tokens, API key/secret, authorization headers
- room/community/channel/user identifiers
- participant names/identities
- device labels or capture source titles
- media content, message content, raw SDP/ICE credentials
- full provider errors without redaction review

## User recovery

- Token/config failure: retry; open diagnostics if repeated.
- Network failure: check network and retry.
- Microphone denied: open OS privacy guidance; room may remain connected muted.
- Screen recording denied: open platform guidance; voice continues.
- Reconnecting: preserve UI and show non-blocking status.
- Share failure: stop local tracks where possible and keep the room stable.

## Alert placeholders

- Voice join success below 98% over 15 minutes.
- Token failure above 2% or sudden `VOICE_NOT_CONFIGURED` events.
- Reconnect rate more than 3x seven-day baseline.
- Screen-share start success below 95% per platform.
- Permission-denied change more than 2x baseline after a release.
- Crash/error correlation with active voice session.

Thresholds require staging baselines before production activation.

## Operational checklist

1. Confirm Edge Function secrets by name only.
2. Invoke token function with valid/invalid auth and voice/non-voice channels.
3. Complete two-client voice and speaking tests.
4. Test microphone and screen permission denial.
5. Interrupt network, sleep/wake, reconnect, and leave.
6. Verify screen tracks stop on leave/window close.
7. Export diagnostics and confirm no forbidden fields.
8. Review provider dashboard without copying token/participant data.

## Automated checks

```powershell
npm run livekit:smoke
npm run diagnostics:smoke
npm run secrets:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

## Remaining work

- Establish platform baselines and approved alert thresholds.
- Connect metrics only through the consented, redacted observability pipeline.
- Add automated voice state-machine tests with a provider test environment.
- Complete cross-platform screen-share certification in Task 83.
