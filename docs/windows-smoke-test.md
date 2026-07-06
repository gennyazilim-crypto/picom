# Windows Package Smoke Test

Picom is a desktop-only Electron app. This checklist verifies that the Windows package keeps the MVP shell stable without introducing mobile or web-first behavior.

## Prerequisites

- Windows 10 or later.
- Node dependencies installed with `npm install`.
- No production secrets in `.env`.
- Build artifacts are generated under `release/`, which is ignored by git.

## Build commands

```powershell
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:win:dir
```

Use `npm run package:win` only when an installer artifact is needed.

## Configuration checks

- `appId` is `com.picom.desktop`.
- `productName` is `Picom`.
- Default window size is `1440x900`.
- Minimum window size is `1100x700`.
- Native File/Edit/View menu is disabled.
- Custom titlebar is visible.
- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- Preload bridge is used instead of raw Electron APIs in React.
- Windows icon path is `assets/brand/app-icon.ico`.

## Runtime smoke checklist

- Launch the unpacked Windows app from `release/win-unpacked/Picom.exe`.
- Confirm no native File/Edit/View/Window menu is visible.
- Confirm only the Picom custom titlebar is visible.
- Confirm minimize, maximize/restore, and close work.
- Confirm normal window mode keeps the premium rounded frame.
- Confirm maximized mode removes outer padding/radius and fills the window.
- Confirm the app background is not black or leaking behind the frame.
- Confirm the 4-column community layout renders.
- Confirm Home/Mention Feed still opens.
- Confirm CommunitySidebar channel switching works.
- Confirm MessageComposer stays pinned.
- Confirm mock message sending works.
- Confirm light/dark theme toggles.
- Confirm no mobile navigation or mobile layout appears.

## Supabase mode notes

- For package smoke, Supabase credentials are optional.
- If Supabase env values are absent, the app should stay in mock/safe mode and not crash.
- If Supabase env values are present, login/session restore must not crash on empty session.

## Pass criteria

- Package builds or unpacked app launches on Windows.
- No renderer startup crash.
- No native Electron menu returns.
- No duplicate titlebar/chrome.
- No mobile UI appears.
- MVP mock mode is usable.

## Known limitations

- This smoke test does not validate code signing.
- Installer reputation and SmartScreen behavior are outside this local smoke test.
