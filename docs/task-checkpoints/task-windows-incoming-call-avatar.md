# Windows Incoming Call Avatar Checkpoint

## Outcome

Incoming DM call notifications now resolve the caller from the current Supabase profile, prepare the image in Electron's main process, and render only a validated local PNG data URL in the Windows call surface.

## Security contract

- `resolve_incoming_call_caller_profile` returns caller media metadata only to an authenticated participant of an active DM call.
- Private `profile-media` objects use a 15-minute signed URL; public URLs remain a safe compatibility fallback.
- Renderer IPC cannot provide a local filesystem path.
- Main-process downloads allow only approved HTTPS hosts, enforce MIME/size/dimension limits, and normalize the result to a 256px square PNG.
- Cache files live under Electron `userData`, use versioned caller keys, atomic writes, concurrent request deduplication, age cleanup, and a total-size limit.
- Fallback order is exact cache, bounded download, generated initials, then the Picom app icon.
- Remote URLs and signed query strings are not written to logs.

## Runtime behavior

- Ringtone and in-app incoming-call state begin immediately.
- Caller profile resolution updates the same state consumed by the in-app overlay and desktop notification service.
- Desktop presentation waits at most 1.2 seconds for the remote image and safely falls back.
- Dismissed or superseded calls cannot reopen a stale notification after an asynchronous download.
- The Picom application icon remains separate from the caller portrait.
- The existing stable Picom AppUserModelID remains the Windows application identity; caller media never replaces it.

## Validation

- `npm run incoming-call:avatar:smoke`
- `npm run incoming-call:desktop:smoke`
- `npm run typecheck`
- `npm run build`
- `npm run mock:smoke`

Validated on 2026-07-19:

- Incoming-call avatar smoke: PASS, 20 checks.
- Existing incoming-call desktop smoke: PASS, 13 checks.
- Electron main/preload build: PASS.
- Renderer production build (`vite build`): PASS.
- Mock smoke, QA smoke, IPC fuzz, and migration integrity: PASS.
- Repository-wide typecheck and the composite `npm run build`: BLOCKED by pre-existing DM call UI type errors in `src/App.tsx` and `src/components/directMessages/DmCallInformation.tsx`; no incoming-call avatar file reports a TypeScript error.

## Manual Windows test

1. Use two authenticated accounts in the same DM and set a real profile avatar on the caller.
2. Unfocus Picom on the recipient and start a voice call.
3. Confirm the incoming surface shows the caller avatar, caller name, and voice-call label.
4. Change the caller avatar and start another call; confirm the new version replaces the old cache entry.
5. Repeat with a private profile-media object and confirm the notification still renders.
6. Remove the avatar and confirm the generated initials fallback appears without delaying the ringtone.
7. Decline during a slow image request and confirm no stale toast appears afterward.
