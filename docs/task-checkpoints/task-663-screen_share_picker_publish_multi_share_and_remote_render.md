# Task 663 checkpoint: member Screen Share picker, publish, multi-share, and render

## Implemented

- Preserved the validated Electron `desktopCapturer` boundary in main, narrow context-isolated preload methods, trusted-sender checks, focused-window explicit-action guard, bounded source output, unpredictable request IDs, source allowlist session, expiry, selection, cancel, and cleanup.
- Added an explicit Refresh action that cancels the prior source session and requests a fresh validated screen/window list.
- Kept capture behind an explicit user click and kept system-audio capture hidden (`audio:false`) until packaged Windows evidence exists.
- Removed the remote-participant conflict gate. Every connected active member with a server screen grant may publish one local share even while other members are sharing.
- Preserved the same-user local conflict guard so restarting requires an explicit stop and new source selection.
- Retained all remote screen publication descriptors during focused subscription changes. Unsubscribed shares remain visible in the sharer switcher without retaining screen pixels.
- Added a focused active-sharer switcher. One live share renders in the main stage at a time while every active sharer remains selectable; this keeps bandwidth bounded without role denial.
- Added safe pending UI while a newly focused remote track subscribes, plus participant identity and generic source labels.
- Preserved local source-ended, explicit stop, unpublish, participant-left, room disconnect, app shutdown, listener removal, and media-track cleanup.
- Screen content is never persisted or logged.

## Provider and native boundary

- Task 661 protected run `29194842117` proved server Screen token grants for every active-member role fixture.
- Source implementation and contract tests do not claim a second-client native render. Hosted two-client evidence is Task 665 and packaged Windows source/audio certification is Task 666.

## Targeted validation

- `npm run screen-share:bridge:full-mvp:smoke`
- `npm run screen-share:publish:full-mvp:smoke`
- `npm run screen-share:preview:test`
- `npm run screen-share:recovery:test`
- `npm run screen-share:quality:test`
- `npm run livekit:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run performance:budget:ci`

## Validation result

- Locked install: PASS; zero reported audit vulnerabilities.
- Secure Electron picker/preload bridge: PASS, 14 checks.
- LiveKit publish, multi-sharer descriptor, remote render, stop, and cleanup contract: PASS, 18 checks.
- Preview/source label/stop/switcher controls: PASS.
- Permission recovery and source-ended behavior: PASS.
- Screen quality presets: PASS.
- LiveKit dependency/service/UI/token/bridge smoke: PASS.
- TypeScript and explicit mock mode: PASS.
- Electron main/preload and renderer production build: PASS.
- Performance budget: PASS; switcher styles are a `1.1 KiB` lazy VoiceRoomView stylesheet and initial CSS remains `239.9 KiB`, below the `240.0 KiB` hard cap.
- Existing initial-JS/initial-CSS target advisories, total-asset target advisory, and large lazy LiveKit chunk warning remain explicit optimization debt; no cap was raised.
