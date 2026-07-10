# Voice Quality Metrics

Status: Privacy-safe current-session diagnostics

## Implemented signals

`voiceService.getDiagnosticsSummary()` exposes only:

- coarse connection state and connected boolean;
- participant count, without identities;
- mute/deafen/screen-share booleans and remote share count;
- stable last error code;
- local participant connection quality: excellent/good/poor/lost/unknown;
- app-session reconnect, join-attempt, join-failure and device-error counts;
- active/last session duration bucket: none, under 1m, 1-5m, 5-30m or 30m+.

The restricted Product Health panel displays aggregate quality, reconnect, failure, device-error and duration values. It does not display room or participant identity.

## Collection behavior

- LiveKit `ConnectionQualityChanged` updates only the local participant's coarse quality.
- Reconnect count increments once per transition into reconnecting.
- Join failure increments for failed token or room connection attempts.
- Device errors increment when microphone enable/change fails.
- Session duration is bucketed in memory and resets with app process state.
- No network telemetry provider is configured and these values are not SLO evidence.

## Explicitly prohibited

- Audio recording, transcription, voice content, speaker identification or voice prints.
- Raw WebRTC stats dumps, SDP, ICE candidates, IP/network addresses or device labels/IDs.
- Room name, community/channel ID, participant identity/name or speaking timeline in diagnostics export.
- Per-user quality histories or persistent behavior profiles.
- Tokens, LiveKit URL/key/secret, provider payloads or stack traces.

## Packet/statistics decision

LiveKit/WebRTC can expose packet loss, jitter, RTT, bitrate and codec statistics. Raw polling is not enabled because it can be high-volume, platform-sensitive and may expose network/device details. A future implementation may collect short-lived coarse buckets only after:

- explicit purpose and privacy/security review;
- low-frequency sampling and strict field allowlist;
- local aggregation into bounded quality buckets;
- removal of IP, candidate, SSRC, track/participant, room and device identifiers;
- no content/recording;
- opt-in/disclosure and short retention where external transmission is proposed;
- staged CPU/memory/battery impact tests.

## Operational use

- Support may ask for the safe summary after user review; never request audio recordings or raw WebRTC internals.
- Product Health values can identify a local connection pattern but cannot establish provider incident scope.
- Production voice join SLO requires authoritative token/provider outcomes and valid-attempt denominators.
- A spike in aggregate join/reconnect/device failures should link to the LiveKit incident runbook and rollout gate.

## Testing

- `npm run voice:quality:test`
- `npm run livekit:smoke`
- Manual two-client join, reconnect, device permission denial and quality degradation on Windows/Linux/macOS.

## Remaining gaps

- Hosted LiveKit quality event certification and platform permission tests.
- Approved production aggregate telemetry/alerting.
- Optional coarse packet-quality buckets, only after privacy/performance review.
