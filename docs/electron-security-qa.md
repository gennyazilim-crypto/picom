# Electron Security QA

Picom uses a custom desktop shell, so Electron security settings must stay locked down.

## Command

```powershell
npm run electron:security:smoke
```

`npm run qa:smoke` includes this check.

## Required settings

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- native menu hidden
- blocked webview attachment
- guarded window-open handling
- frozen preload bridge
- IPC channel allowlist

## Manual QA

- Start Electron dev mode.
- Confirm no native File/Edit/View menu appears.
- Confirm the custom titlebar is still the only visible chrome.
- Confirm renderer code cannot directly import Electron APIs.
- Confirm window controls still work through the preload bridge.
