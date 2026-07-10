# Task 309 - Security headers and CSP production

## Result

- Vite injects separate development and production CSP meta policies.
- Production restricts script/style/image/connect/media/frame/object/base/form/worker/manifest sources and contains no `unsafe-eval`.
- Supabase API/Storage/Realtime and LiveKit signaling are allowed only through validated HTTPS/WSS build origins.
- Localhost Vite HMR exceptions exist only in development.
- Dev/preview responses add nosniff, no-referrer, frame denial, and restrictive browser permissions headers.
- CSP smoke recursively rejects unsafe HTML/frame/webview/object usage and checks built output.

## Validation

- `npm run build`
- `npm run csp:smoke`
- `npm run electron:security:smoke`
- `npm run secrets:smoke`
- `npm run mock:smoke`
- `npm run typecheck`

## Remaining note

`style-src 'unsafe-inline'` remains for current inline style values. It does not permit inline script execution and needs a separate nonce/hash migration before removal.
