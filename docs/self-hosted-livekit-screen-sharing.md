# Self-hosted LiveKit screen sharing

## Runtime contract

Picom keeps screen capture and media transport separate. Electron main enumerates screens and windows after an explicit user action. The validated preload bridge returns only bounded source metadata. The renderer then captures the selected source and publishes the video track to the existing self-hosted LiveKit room as `Track.Source.ScreenShare`.

Every authenticated active community member receives the same ordinary screen-publish capability. Owner, administrator, and moderator roles are not required. Visitors, inactive members, blocked users, invalid rooms, and unavailable infrastructure remain denied by the existing token and membership boundary.

## Privacy and safety

- No raw `desktopCapturer`, Node, provider secret, TURN credential, or LiveKit API secret is exposed to React.
- Capture starts only after the user chooses a source and confirms Start sharing.
- System-audio capture remains disabled because it has not been certified across the packaged Windows, Linux, and macOS targets.
- Screen pixels, thumbnails, and tracks are not stored or written to application logs.
- Selection cancellation invalidates the pending native request.
- Source-ended, stop, participant-left, room disconnect, and leave paths detach or stop their tracks.

## Multiple sharers

Remote screen publications are keyed by participant identity and track SID. Picom lists simultaneous shares and provides a visible switcher. Only the selected remote screen is subscribed at full view, preventing unbounded rendering while preserving access to every active sharer.

## Local verification

Run:

```powershell
npm run screen:self-hosted:smoke
npm run livekit:local:start
npm run livekit:local:e2e
npm run livekit:local:cleanup
```

The contract smoke validates the secure source bridge and lifecycle. The local E2E launches two Electron clients against the native self-hosted LiveKit server and verifies publish, remote render, stop, reconnect, and cleanup without a cloud subscription.

## Remaining native evidence

Packaged Windows source-picker permission behavior, macOS Screen Recording permission recovery, Linux Wayland portal behavior, and real internet/TURN screen transport require their dedicated later certification tasks. Missing evidence must be shown as blocked; it must not hide Voice Rooms or Screen Share from the V1 interface.
