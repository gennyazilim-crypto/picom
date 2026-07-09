# Picom macOS Permissions

## Declared purpose strings

- Microphone: Picom uses microphone access for MVP voice rooms when the user joins a voice channel.
- Screen capture: Picom uses screen recording access only when the user chooses to share a screen.

Review wording with product/legal before public release. Picom does not request these permissions at startup.

## Microphone test

1. Start with Picom absent/disabled under System Settings > Privacy & Security > Microphone.
2. Join an approved synthetic voice room and attempt to unmute.
3. Verify macOS prompt/denial produces a clear Picom error and user remains safely connected muted where possible.
4. Verify no raw device ID, audio sample, token, or OS account data enters logs.
5. Enable Picom permission, quit fully, relaunch, rejoin, and verify audio/speaking/mute.
6. Disable permission while/after use and confirm next attempt fails safely without stale capture.

Development Electron/terminal identity prompts do not prove final signed Picom bundle behavior.

## Screen Recording test

1. Start with Picom absent/disabled under System Settings > Privacy & Security > Screen Recording.
2. Join a voice room and select **Choose source**.
3. Verify missing permission yields empty/limited sources or a safe error without crash.
4. Enable Picom, quit/relaunch when macOS requests it, and reopen the picker.
5. Select a synthetic non-sensitive screen/window, start sharing, and verify local/remote preview.
6. Stop sharing, leave room, close app, and verify capture indicator/track stops.
7. Disable permission and repeat denial path.

Never log source thumbnails, screen frames/content, source IDs beyond transient runtime need, tokens, or private window titles.

## Other access

Picom Full MVP does not request camera, location, contacts, calendars, photos library, accessibility control, automation/Apple Events, or broad filesystem access. Any future permission requires separate scope, purpose string, entitlement, privacy review, and native QA.

## Support guidance

- Direct users to System Settings > Privacy & Security > Microphone or Screen Recording.
- Explain that app restart may be required.
- Do not advise disabling Gatekeeper or system privacy protections globally.
- Collect only redacted app/version/platform/error state; never request screenshots containing secrets/private content unless the user deliberately redacts them.
