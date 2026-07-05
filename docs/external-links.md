# Safe External Link Handling

Picom uses a centralized external link service so renderer components never open arbitrary URLs directly.

## Approved service

- Canonical file: `src/services/desktop/externalLinkService.ts`
- Compatibility re-export: `src/services/externalLinkService.ts`
- Native Electron bridge: `window.picomDesktop.externalLinks.openUrl()`
- Main process handler: `picom:external-open-url`

## API

```ts
externalLinkService.isSafeUrl(url)
externalLinkService.normalizeUrl(url)
externalLinkService.getDisplayDomain(url)
externalLinkService.confirmExternalUrlPlaceholder(url)
externalLinkService.openExternalUrl(url)
```

## Rules

- Allow only `http:` and `https:` external URLs by default.
- Block `javascript:`, `file:`, `data:`, shell-like, and unknown protocols.
- Picom deep links such as `picom://settings` and legacy `myapp://` placeholders must go through `deepLinkService`, not `externalLinkService`.
- React components should call services, not Electron APIs.
- Browser fallback may use `window.open`, but only inside `externalLinkService` after URL normalization.
- Electron uses `shell.openExternal` only through the safe preload/IPC bridge.

## User-facing behavior

- Safe message URLs are rendered as compact inline link buttons.
- Unsafe protocols remain plain text or return a friendly blocked-link error.
- Status/help links should show a configured/not-configured state rather than silently failing.

## Manual test steps

1. Send a mock message containing `https://example.com` and click the link.
2. Confirm the link opens externally in Electron, or in a browser tab in fallback mode.
3. Try `javascript:alert(1)` or `file:///C:/Windows/System32/calc.exe`; it should not render/open as a safe external link.
4. Use Settings > Advanced > Open system status with and without `VITE_STATUS_PAGE_URL` configured.
5. Confirm `picom://settings` still goes through `deepLinkService` simulation/native protocol handling.

## Remaining work

- Add a real confirmation modal if product wants to warn before opening external domains.
- Add allowlisted support/documentation domains once production URLs are finalized.
- Add automated renderer interaction tests when UI E2E coverage is introduced.

Implementation guard: shell.openExternal only through the safe preload/IPC bridge.
