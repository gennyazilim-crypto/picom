# Content Security Policy Plan

Picom is an Electron desktop app with a React/Vite renderer. This document defines the intended Content Security Policy posture for development, packaged desktop builds, backend/API access, uploaded attachments, and future object storage/CDN delivery.

## Goals

- Reduce XSS and unsafe resource loading risk in the desktop renderer.
- Keep Vite development mode usable without weakening packaged builds.
- Ensure message rendering does not require unsafe HTML.
- Route external navigation through native-safe link handling rather than embedded remote pages.
- Prepare a stricter production CSP before public beta packaging.

## Current state

- `index.html` is minimal and does not include inline scripts.
- React entrypoint is loaded with a module script from `/src/main.tsx` in development.
- Electron blocks untrusted navigation and blocks webview attachment in `electron/main.cts`.
- Renderer code search did not find `dangerouslySetInnerHTML`, direct `innerHTML`, iframes, or webviews in active source files.
- A production CSP is not enforced yet because dev/HMR and packaged Electron behavior need separate policy testing.

## Recommended CSP directives

### Packaged desktop app target

```text
default-src 'self';
base-uri 'none';
object-src 'none';
frame-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https: wss:;
media-src 'self' blob: https:;
worker-src 'self' blob:;
form-action 'none';
frame-ancestors 'none';
upgrade-insecure-requests
```

Notes:

- `style-src 'unsafe-inline'` may be needed for Vite-injected CSS or runtime style attributes. Remove it only after verifying the packaged renderer does not require it.
- `img-src` allows `data:` and `blob:` for local previews and generated avatars; private production attachment rules should still be enforced by storage access controls.
- `connect-src` allows HTTPS and WSS because Supabase, Realtime, and LiveKit/WebRTC signaling require network connections.
- `frame-src 'none'` and `object-src 'none'` match Picom's no-embedded-remote-content posture.

### Local development policy

Development mode needs looser rules for Vite HMR and local dev server connections:

```text
default-src 'self' http://127.0.0.1:5173;
script-src 'self' 'unsafe-eval' http://127.0.0.1:5173;
style-src 'self' 'unsafe-inline' http://127.0.0.1:5173;
img-src 'self' data: blob: https: http://127.0.0.1:5173;
connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 https: wss:;
object-src 'none';
frame-src 'none';
base-uri 'none'
```

This policy is for local dev only and must not be copied into packaged production builds unchanged.

## Resource loading rules

### Scripts

- Allow app-bundled scripts only in packaged builds.
- Do not load third-party scripts in the renderer.
- Do not use dynamic remote code loading.
- Do not add plugin runtime script execution for MVP.

### Styles

- Prefer bundled CSS and design tokens.
- Keep any inline style allowance documented and revisit before beta packaging.
- Do not load remote CSS.

### Images

Allowed image sources:

- App-bundled assets.
- `data:` and `blob:` for local previews/generated placeholders.
- Supabase Storage/object storage URLs once access rules are configured.

Rejected image behavior:

- Do not inject raw HTML for link previews.
- Do not allow arbitrary `file:` image paths in renderer content.

### Connections

Allowed connection sources:

- Local Vite dev server in development.
- Supabase API and Realtime endpoints in API mode.
- LiveKit signaling endpoint in voice/screen-share mode.
- Future status/support URLs only through controlled service configuration.

### Frames and objects

- No iframes for MVP content.
- No Electron webviews.
- No object/embed loading.

## Message and link rendering assumptions

- User-generated message text should be rendered as text/React nodes, not unsafe HTML.
- Link previews must not inject provider HTML.
- External URLs should use `externalLinkService` and Electron's safe external open IPC path.
- Deep links should use `deepLinkService`, not external link handling.

## Implementation path

1. Keep this policy documented while renderer and Supabase/LiveKit URLs stabilize.
2. Add a production CSP injection point before public beta packaging:
   - Option A: meta tag generated for packaged builds only.
   - Option B: Electron response header injection for `file://`/local renderer content if practical.
3. Add an automated packaged smoke test that verifies the CSP does not block boot.
4. Tighten `style-src` and `img-src` once attachment delivery rules are finalized.

## Remaining risks

- CSP is documented but not enforced yet.
- Supabase/LiveKit host allowlists are not fully enumerated because environment URLs are configurable.
- `style-src 'unsafe-inline'` may remain necessary until packaged build CSS is audited.
- Image previews and uploaded attachments require storage access rules beyond CSP.

## Required checks

```bash
npm run csp:smoke
npm run electron:security:smoke
npm run typecheck
npm run build
```

## Decision

Do not enforce a production CSP in this task. Keep the current app stable and add a documented CSP target plus a smoke test that prevents unsafe renderer patterns from being introduced silently.
