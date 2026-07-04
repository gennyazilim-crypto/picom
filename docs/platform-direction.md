# Platform Direction: Electron Desktop App

Picom is a desktop-first community chat application for Windows, Linux, and macOS. The product direction is Electron as the native desktop runtime with a React + TypeScript renderer.

## Supported platforms

- Windows desktop
- Linux desktop
- macOS desktop

Mobile, tablet-first, and web-first responsive layouts are out of scope for the MVP desktop product.

## Current repository state

The current codebase is a Vite + React renderer baseline. Electron shell files are not configured yet in this repository snapshot. This task intentionally does not add Electron dependencies or runtime files because Phase A focuses on safety, scope, and direction before setup work.

## Electron architecture rules

- React components must not call Electron native APIs directly.
- Native capabilities must be exposed through a preload bridge and typed renderer service wrappers.
- `contextIsolation` must remain enabled.
- `nodeIntegration` must remain disabled in renderer windows unless a future task documents a specific justification.
- IPC channels must be named, minimal, and validated.
- Window, tray, clipboard, notifications, file dialogs, menu, and updater behavior should live behind service abstractions.

## Renderer rules

- The renderer remains React + TypeScript.
- The desktop shell keeps the fixed 4-column chat layout.
- No mobile navigation or responsive mobile UI should be introduced.
- Theme, icons, and UI surfaces must follow the Picom design tokens and Coolicons direction.

## Future Electron setup path

A later setup task should add:

- `electron` as a development/runtime dependency.
- Electron main process entry point.
- Secure preload script.
- Typed bridge definitions for renderer services.
- Electron dev script that starts Vite and Electron together.
- Windows, Linux, and macOS packaging configuration.

## Verification status

Electron dev mode cannot be verified yet because the Electron shell has not been added. The safe verification for this task is that the current TypeScript renderer still typechecks and no runtime code was changed.