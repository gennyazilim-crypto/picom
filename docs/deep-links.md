# Desktop Protocol Handler Wiring

Picom registers picom:// for Windows, Linux, and macOS packages.

## Navigation links

Supported renderer navigation includes invite, community/channel/message, Radio, Podcast, settings, and friends routes. Navigation IDs are bounded. Query strings, fragments, embedded credentials, unsupported protocols, and unknown routes fail closed.

## Auth callback ownership

OAuth callback is not renderer navigation. Electron main exclusively accepts auth/callback with attempt_id, state, nonce, provider, purpose, and either code or a bounded error. Main validates these against the active expiring single-use attempt. It stores one valid result in protected auth storage and delivers it through window.picomDesktop.auth. Raw OAuth callback URLs never reach deepLinks.onOpen.

Password recovery and email verification keep dedicated bounded routes.

## Security rules

- Deep links never execute shell commands.
- Deep links never open arbitrary files.
- Unknown routes fail closed.
- OAuth URLs never carry access tokens, refresh tokens, assertions, or secrets.
- Authorization still applies after navigation.

## Tests

Run npm run protocol-handler:smoke, npm run auth:electron-foundation:smoke, and npm run electron:ipc-fuzz:test. Packaged cold/running callback evidence is still required on every desktop platform.
