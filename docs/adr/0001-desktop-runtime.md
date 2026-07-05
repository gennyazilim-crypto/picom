# ADR 0001 - Desktop Runtime

Status: accepted

## Context

Picom is a desktop-only community chat app targeting Windows, Linux, and macOS. The app needs custom window chrome, preload/native service boundaries, packaging, and future media/screen-share support.

## Decision

Use Electron as the desktop runtime for the MVP. Keep the renderer as an untrusted client behind safe preload/service abstractions.

## Consequences

- Custom titlebar and desktop shell can be controlled consistently.
- Windows, Linux, and macOS packaging can share one application stack.
- Native APIs must stay behind preload and service wrappers.
- Electron security settings must remain enforced: `contextIsolation: true` and `nodeIntegration: false`.

## Alternatives considered

- Tauri: smaller runtime, but current project and task chain are Electron-centered.
- Web-only Vite app: insufficient for desktop shell, screen capture, packaging, and native service foundations.
