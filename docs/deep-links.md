# Desktop Protocol Handler Wiring

Picom supports a desktop custom protocol placeholder for Windows, Linux, and macOS builds:

```text
picom://
```

This protocol is registered through Electron Builder metadata and forwarded safely from Electron main/preload into the renderer `deepLinkService`.

## Supported links

- `picom://invite/{code}`
- `picom://community/{communityId}`
- `picom://community/{communityId}/channel/{channelId}`
- `picom://community/{communityId}/channel/{channelId}/message/{messageId}`
- `picom://radio/{communityId}/session/{sessionId}`
- `picom://podcast/{communityId}/episode/{episodeId}`
- `picom://settings`
- `picom://friends`

All ids/codes must match:

```text
[a-zA-Z0-9_-]{1,128}
```

Links with query strings, hashes, usernames, passwords, unsupported protocols, or unsupported routes are ignored by the native bridge.

## Electron wiring

- `electron-builder.yml` registers the `picom` scheme.
- `electron/main.cts` calls `app.setAsDefaultProtocolClient("picom")`.
- `electron/main.cts` handles second-instance launch arguments.
- `electron/main.cts` handles macOS `open-url` events.
- `electron/preload.cts` exposes `window.picomDesktop.deepLinks.onOpen()`.
- `src/services/deepLinkService.ts` parses and dispatches validated deep link actions in the renderer.

## Security rules

- Deep links never execute shell commands.
- Deep links never open arbitrary files.
- Unknown routes fail closed.
- Native bridge validates supported routes before forwarding to renderer.
- Renderer validates again before dispatch.
- Radio and Podcast routes resolve the requested source through the service layer and reject inaccessible, private, draft, archived, or deleted content before navigation.
- Feature availability and backend permissions still apply after navigation.

## Browser/dev simulation

Development can still use:

```ts
deepLinkService.simulateDeepLink("picom://settings")
```

This keeps browser/Vite mode safe when no native protocol registration exists.

## Manual test steps

1. Run `npm run protocol-handler:smoke`.
2. Run `npm run electron:dev`.
3. In development, simulate a link through the renderer service if needed.
4. In a packaged build, open one supported URL such as `picom://settings` from the OS run dialog/terminal.
5. Confirm the existing Picom window focuses and unsupported URLs do not crash the app.

## Unsupported examples

These must be ignored:

- `javascript:alert(1)`
- `file:///C:/Windows/System32/calc.exe`
- `picom://community/../../bad`
- `picom://settings?token=secret`
- `picom://unknown/path`
