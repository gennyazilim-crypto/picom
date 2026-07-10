# Content Security Policy

## Production enforcement

Picom is an Electron desktop app with a React/Vite renderer. `vite.config.ts` injects a CSP meta tag into built HTML. Production permits bundled code and exact configured service origins; it does not permit `unsafe-eval`, remote scripts, frames, objects, unsafe message HTML, or arbitrary network hosts.

Production directives:

```text
default-src 'self';
base-uri 'none';
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: <validated Supabase Storage origin>;
font-src 'self' data:;
connect-src 'self' <validated Supabase HTTPS/WSS, LiveKit, remote-config and status origins>;
media-src 'self' blob: <validated Supabase Storage origin>;
worker-src 'self' blob:;
manifest-src 'self';
form-action 'none';
upgrade-insecure-requests
```

`VITE_SUPABASE_URL` contributes its validated HTTPS origin to API/Storage/image/media access and the equivalent WSS origin to Realtime. `VITE_LIVEKIT_URL`, `VITE_REMOTE_CONFIG_URL`, and `VITE_STATUS_PAGE_URL` contribute only validated `https:` or `wss:` origins where applicable. Missing/invalid values remain blocked rather than widening to all HTTPS/WSS hosts.

`style-src 'unsafe-inline'` remains because current React surfaces use inline style values. It does not allow inline scripts. Remove it only after a focused nonce/hash or style migration plus packaged regression testing.

## Development policy

Local development uses the same base policy and adds only:

- `http://127.0.0.1:5173` for the Vite module server.
- `ws://127.0.0.1:5173` for HMR.
- `script-src 'unsafe-eval'` for Vite development tooling.

Development removes `upgrade-insecure-requests`. These exceptions are selected by Vite's `serve` command and are absent from production builds.

Vite dev/preview responses also set:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy` for camera, geolocation, payment, and USB

Microphone and screen capture are controlled through explicit Electron/WebRTC permission flows, not a broad browser Permissions-Policy grant.

## Resource rules

- Scripts and CSS are bundled; no remote code or plugin runtime is loaded.
- Local previews/generated artwork use `data:` or `blob:` images.
- Production attachment images/media use the configured Supabase Storage origin and still require Storage/RLS authorization.
- LiveKit WebRTC signaling uses the configured origin; media transport security and token authorization remain separate controls.
- External pages never render in iframe/webview/object elements and open only through `externalLinkService` safe IPC.
- Deep links route through `deepLinkService` validation.

## Message and preview safety

User messages, profile text, comments, and link-preview copy render as React text nodes. The source gate rejects `dangerouslySetInnerHTML`, direct `innerHTML` assignment, iframe, webview, and object embedding. Do not weaken CSP to support untrusted provider HTML.

## Release verification

1. Build with the exact approved public Supabase/LiveKit/remote-config/status URLs.
2. Run `npm run build` followed by `npm run csp:smoke`.
3. Inspect `dist/index.html`; production CSP must exist and must not include `unsafe-eval`.
4. Run packaged startup, auth, message, upload, Realtime, voice, and screen-share smoke on Windows/Linux/macOS.
5. Treat required-flow CSP violations as release blockers. Add only the exact reviewed origin/directive.
6. Verify backend/API, Storage, and Edge Functions enforce their own CORS/security headers; renderer CSP is not backend authorization.

## Remaining risks

- Meta CSP protects the renderer document but cannot replace backend headers, RLS, Storage policy, token validation, or safe IPC.
- Incorrect build-time endpoints intentionally break connected features and require a corrected rebuild.
- Inline styles remain allowed until migrated.
- External user-supplied image URLs outside approved Storage are intentionally blocked.
