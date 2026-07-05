# Voice and Screen Share QA

Picom uses Supabase Edge Functions for LiveKit tokens and LiveKit/WebRTC for MVP voice and screen sharing. This checklist verifies the desktop-only flow on Windows, Linux, and macOS without exposing tokens, secrets, device IDs, or captured screen content.

## Automated checks

Run these from the project root before manual QA:

```bash
npm run typecheck
npm run build
```

Expected result:

- TypeScript passes.
- Electron main/preload build passes.
- Vite build passes.
- A bundle size warning is acceptable until the bundle-size optimization task.

## Shared manual setup

1. Configure Supabase environment variables for the renderer.
2. Deploy or run the `livekit-token` Supabase Edge Function.
3. Configure LiveKit server URL, API key, and API secret only in Supabase function secrets.
4. Start Picom in Electron dev mode or from a packaged desktop build.
5. Sign in with two test users.
6. Open the same community voice channel in two clients.

## Voice QA

1. Join the voice room from client A.
2. Confirm the status changes from connecting to connected.
3. Confirm client A appears in the connected users list.
4. Join from client B.
5. Confirm both clients appear in both participant lists.
6. Toggle mute on client A.
7. Confirm client A shows muted state.
8. Toggle deafen on client A.
9. Confirm remote audio subscription state remains stable and UI shows deafen state.
10. Speak from each client and confirm the speaking indicator appears.
11. Leave from client A and confirm participant lists update.

## Screen share QA

1. Join the voice room before sharing.
2. Click `Choose source`.
3. Confirm screen/window sources appear only after the click.
4. Select one source.
5. Click `Start sharing`.
6. Confirm local screen-share viewer renders on client A.
7. Confirm remote screen-share viewer renders on client B.
8. Click `Stop sharing`.
9. Confirm both viewers clear.
10. Start sharing again and then leave the room.
11. Confirm local capture stops and viewer state clears.

## Platform notes

- Windows: verify Windows privacy settings allow capture and microphone access.
- Linux: test Wayland with PipeWire/desktop portals where practical, and X11 if available.
- macOS: verify Microphone and Screen Recording permissions in System Settings, then restart Picom after permission changes.

## Failure cases

- Missing LiveKit token function should show a safe token error.
- Missing microphone permission should keep the user connected as muted when possible.
- Missing screen recording permission should show a safe screen-share error.
- Backend/network failure should not crash the renderer.
- Source picker failure should not break voice controls.

## Security checks

- No LiveKit API secret appears in renderer code, logs, diagnostics, or build output.
- No Supabase service role key appears in renderer code, logs, diagnostics, or build output.
- No source thumbnails, screen frames, or device IDs are persisted.
- Renderer does not import or call Electron `desktopCapturer` directly.
- Screen capture source access goes through the preload/main IPC bridge only.
