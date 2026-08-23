# PICOM Authentication V2 provider configuration audit

Audit date: 2026-08-23. This report records only configuration state. It never prints values or secrets.

| Requirement | Local status | Evidence / required production gate |
| --- | --- | --- |
| Renderer Supabase URL | PRESENT | Local/runtime readback found a configured public URL. |
| Renderer Supabase anon key | PRESENT | Local/runtime readback found a configured publishable/anon key. Never a service-role key. |
| `auth.picom.gg` renderer URL | PRESENT (source default) | Application source safely defaults to `https://auth.picom.gg`. Live TLS/health proof is still required. |
| Google client ID / secret | UNVERIFIED | Must be configured in Supabase Auth only; never in Vite/Electron/preload. |
| Google redirect URI | MISSING (local/runtime) | Must be `https://auth.picom.gg/google/callback`; Supabase allowlist remains separately UNVERIFIED. |
| Google redirect allowlist | UNVERIFIED | Supabase must allow `https://auth.picom.gg/google/callback` and `picom://auth/callback`. |
| Epic client ID / secret / deployment ID | UNVERIFIED | Required by `epic-auth`. Store only in Edge/gateway secret storage. |
| Epic callback | UNVERIFIED | Must be `https://auth.picom.gg/epic/callback`. |
| Steam Web API key / OpenID configuration | UNVERIFIED | Required by `steam-auth`. |
| Steam callback / realm | PRESENT (source) | Canonical realm `https://auth.picom.gg/` and return `https://auth.picom.gg/steam/callback`. Hosted proof UNVERIFIED. |
| Gateway TLS / reverse proxy | PRESENT | `GET https://auth.picom.gg/health` returned `200 OK` with HTTPS security headers on 2026-08-23. |
| Edge service-role key | UNVERIFIED | Required only in trusted Edge secret storage. Must never reach renderer, preload, bundle, or logs. |
| Electron `picom://` registration | PRESENT (source) | Packaged Windows protocol metadata is present; packaged runtime evidence remains required. |
| Provider enable flags | PRESENT | Flag values are intentionally not printed; live provider configuration remains UNVERIFIED. |

## Live probe (2026-08-23, this workstation)

| Check | Status |
| --- | --- |
| `GET https://auth.picom.gg/health` | PRESENT — `200 OK`, `{ "ok": true }` response, HTTPS security headers |
| Google client ID / secret | UNVERIFIED |
| Google redirect URI | MISSING (local/runtime readback) |
| Supabase redirect allowlist | UNVERIFIED |
| Epic trusted credentials | UNVERIFIED |
| Steam trusted credentials | UNVERIFIED |
| Production renderer bundle secret strings (`service_role`, `EPIC_CLIENT_SECRET`) | absent |

Do not treat a rendered provider button as validation. Google/Epic/Steam remain `BLOCKED_EXTERNAL_CONFIGURATION` until real provider authentication, `auth.picom.gg` callback, `picom://auth/callback`, a Supabase session, profile load, and packaged session restore are proven.

## Required configuration before any provider can be marked PASS

1. Configure Supabase Auth with PKCE and the exact allowed callback URLs.
2. Deploy `auth.picom.gg` behind valid TLS with `/google`, `/epic`, and `/steam` start+callback routes.
3. Store Google/Epic/Steam credentials only in Supabase or trusted server/Edge secret storage.
4. Enable only the public renderer flags after the corresponding backend is live.
5. Run real-account provider smoke tests and the packaged Windows deep-link test. Button rendering is not validation.
