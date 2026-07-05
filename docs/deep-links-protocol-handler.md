# Deep Links and Protocol Handler

Task 287 wires the Picom deep-link foundation.

## Supported links

- `picom://settings`
- `picom://friends`
- `picom://invite/{code}`
- `picom://community/{communityId}`
- `picom://community/{communityId}/channel/{channelId}`
- `picom://community/{communityId}/channel/{channelId}/message/{messageId}`

## Current behavior

- Electron registers `picom://` as the desktop protocol handler when the app is ready.
- Second-instance launches forward safe deep-link arguments to the existing window.
- Renderer deep links are parsed by `deepLinkService`.
- Settings and friends links open their placeholder surfaces.
- Community/channel links switch local UI state when the target exists.
- Invite acceptance and message highlight remain placeholders.

## Security rules

- Only `picom://` links are accepted.
- Deep-link length is capped.
- Route segments must be alphanumeric, dash, or underscore.
- Unknown routes fail safely.
- Deep links never execute shell commands.

## Manual test steps

1. Run `npm run dev`.
2. Open DevTools console.
3. Run `window.picomDesktop` only to confirm the native bridge exists if needed.
4. In app code or a temporary console hook, call `deepLinkService.simulateDeepLink("picom://settings")`.
5. Confirm Settings opens.
6. Simulate `picom://friends`.
7. Confirm Friends foundation opens.
8. Simulate an existing community/channel link and confirm the app switches view.
