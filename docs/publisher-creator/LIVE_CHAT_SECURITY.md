# Live Chat Security

## Authorization

- No authenticated INSERT/UPDATE/DELETE grants on chat tables
- Mutations via SECURITY DEFINER RPCs with fixed `search_path`
- Anon write denied; Live Now chat requires auth for read/write

## Anti-spam / rate limits

- Burst: 5 / 10s
- Sustained: 30 / 60s
- Slow mode: 0/5/10/30/60/120s server-enforced
- Duplicate fingerprint (sha256 of normalized body) within 60s
- Long repeated-character runs rejected
- `javascript:` / `data:text/html` rejected
- Links blocked when `links_allowed=false`

## XSS

Client renders message body as React text nodes only. Script/HTML payloads stay inert.

## Feature flags

Production:

- `enableLiveChat=OFF` unless `PICOM_ENABLE_LIVE_CHAT=true`
- `enableLiveModeration=OFF` unless `PICOM_ENABLE_LIVE_MODERATION=true`

Do not treat Go Live flag as chat security.
