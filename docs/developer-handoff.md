# Picom Developer Handoff

## Product and status

Picom is a desktop-only Electron community chat app for Windows, Linux, and macOS. The renderer is React + TypeScript + Vite. Supabase owns the planned Auth/Postgres/RLS/Storage/Realtime/Edge backend, and LiveKit owns voice/screen share.

Current source version is `0.1.1-beta.1`. Local QA/build and a Windows private beta package path work. Stable release is No-Go; read `docs/stable-go-no-go.md` before planning release or MVP+ work.

## First checkout

```powershell
git clone <approved-picom-repository>
cd picom
npm ci
Copy-Item .env.example .env.local
npm run env:placeholders:check
npm run quality:fast
npm run dev
```

`npm run dev` is the intended Electron development command. It builds Electron, starts Vite on `127.0.0.1:5173`, and opens the desktop window. Use `npm run renderer:dev` only for renderer-specific investigation.

Mock mode is the safe default and requires no backend:

```text
VITE_DATA_SOURCE=mock
```

## Architecture boundaries

- `electron/main.cts`: BrowserWindow, custom chrome, menu removal, native IPC, tray/window/protocol/screen capture.
- `electron/preload.cts`: frozen minimal `window.picomDesktop` bridge; never expose raw Electron/Node.
- `src/App.tsx`: application view/state integration and service orchestration.
- `src/components`: desktop UI; must call services rather than direct native/Supabase implementations.
- `src/services`: data-source, domain, desktop, diagnostics, Supabase, LiveKit, auth, permission boundaries.
- `supabase/migrations`: ordered schema/RLS/Storage/Realtime source of truth.
- `supabase/functions`: protected Edge Functions and shared auth/CORS/error helpers.

Electron security invariants: `contextIsolation: true`, `nodeIntegration: false`, sandbox/webSecurity enabled, no native application menu, no direct native API calls from React.

## UI and design

- Global tokens/layout/styles: `src/styles.css`.
- Reusable icons: `src/components/AppIcon.tsx`, Coolicons attribution in `THIRD_PARTY_NOTICES.md`.
- Mock communities/messages/members: `src/data/mockCommunities.ts` and related `src/data` modules.
- Original Picom brand assets: `assets/brand`.
- Desktop shell is fixed/dense; below minimum size shows a desktop warning rather than mobile reflow.

Do not add Discord branding/assets/exact colors or a mobile/browser-first layout.

## Main views

App-level view state selects community chat, Mention Feed/Home, Profile, voice, Settings/overlays, and onboarding/auth states. ServerRail stays the primary community/home entry. Community chat uses CommunitySidebar + ChatMain + optional MemberSidebar; feed/profile use their own desktop content areas without duplicating the titlebar.

Preserve hook ordering: startup/auth guards occur after hooks are declared. Run `npm run react:hooks:smoke` after changing `App.tsx` conditional rendering.

## Supabase mode

Read:

- `docs/supabase-staging-setup.md`
- `docs/supabase-production-setup.md`
- `docs/production-migration-runbook.md`
- `docs/production-rls-verification.md`

Renderer-safe local values are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, data source/release flags, and public callback/provider availability. Service role/access token/database password never enter Vite/renderer.

Static checks:

```powershell
npm run qa:supabase
npm run supabase:rls:production-safe
```

Real pgTAP/deployment requires an installed/authenticated Supabase CLI and isolated staging. Static success is not deployed RLS proof.

## LiveKit mode

Read `docs/livekit-production-setup.md` and `docs/livekit-production-smoke-test.md`.

The renderer requests a short-lived token from protected Supabase `livekit-token`; API key/secret remain Function-only. Room name is `community:{communityId}:voice:{channelId}`, identity is Supabase user ID, TTL is one hour.

```powershell
npm run livekit:smoke
```

Native microphone/screen-share/two-client tests are still required on each supported OS/provider environment.

## Packaging

```powershell
npm run packaging:smoke
npm run package:win
```

Build Linux/macOS artifacts only on native protected hosts. See platform release docs. `release/` is ignored. No stable auto-publish/update is configured.

## Known critical gaps

1. Live production-like Supabase/RLS/Storage/Realtime/Edge evidence.
2. Historical private attachment signed-URL refresh after reload.
3. LiveKit deployed/native two-client matrix.
4. Native Linux/macOS package and stable signing/notarization.
5. Windows stable signing/lifecycle smoke.
6. Real backup restore/rollback drill.
7. Final legal/privacy/publisher/support approval.

Do not start MVP+ features until these gates and a new Go decision are complete.

## Task workflow

1. Read the current scope/backlog/checkpoint and inspect only required files.
2. Make one bounded task change; do not refactor unrelated code.
3. Run task-specific smoke plus typecheck/mock/build.
4. Document truthful external gaps; never fake native/live success.
5. Create the checkpoint.
6. Stage only intended files; never include local env, release artifacts, logs, or temporary runtime files.
7. Commit with the requested exact message and push.

If unexpected working-tree changes appear, preserve them and confirm ownership rather than reverting them.
