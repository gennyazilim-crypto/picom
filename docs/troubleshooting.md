# Picom Troubleshooting

## `Port 5173 is already in use`

The Electron dev script expects the Picom Vite server on `127.0.0.1:5173`.

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*C:\Users\ACER\Desktop\picom*' } | Select-Object ProcessId,Name,CommandLine
```

Stop only a verified stale Picom Vite/Electron process. Do not terminate unrelated Electron/Codex processes. Then rerun `npm run dev`.

## Electron does not open

1. Run `npm run electron:build` and `npm run renderer:dev` separately to isolate compilation/server errors.
2. Confirm dependencies with `npm ci` and no stale Picom process/port.
3. Run `npm run electron:security:smoke` and `npm run packaging:smoke`.
4. Inspect only redacted project-specific dev output; never paste tokens/env dumps.
5. Use the exact `npm run dev` script rather than launching the Electron binary directly against a missing renderer URL.

## Packaged app shows a white screen

- Verify `npm run build` passes and `dist/index.html` assets use relative packaged paths (`base: "./"` in Vite config).
- Verify `dist/**` and `dist-electron/**` are packaged and preload path is `dist-electron/preload.cjs`.
- Launch `release/win-unpacked/Picom.exe`/native unpacked app and capture redacted startup diagnostics.
- Confirm packaged app is not trying to load `localhost:5173`.
- Do not disable Electron webSecurity/sandbox to hide the issue.

## `Rendered more hooks than during the previous render`

Conditional returns were placed before all root component hooks. Preserve consistent hook order in `App.tsx` and run:

```powershell
npm run react:hooks:smoke
npm run typecheck
```

Do not fix by suppressing the error boundary.

## Safe Mode / no communities

Safe Mode can activate after suspected repeated startup crashes and disables optional services. Use its reset settings/clear cache/export logs/restart normally actions. Do not delete auth/user data manually. In mock mode, confirm `VITE_DATA_SOURCE=mock` and run `npm run mock:smoke`. In Supabase mode, confirm session and configured project without exposing keys.

## Supabase CLI unavailable

Static checks can pass while real migrations/pgTAP remain unrun. Install Supabase CLI using an official method, confirm `supabase --version`, use isolated local/staging targets, then run `npm run supabase:rls:test`. Never claim deployed RLS success from `supabase:rls:smoke` alone.

## Env safety smoke fails

- `.env.example`/`.env.beta.example` are renderer-safe `VITE_` examples only.
- `.env.production.example` is an inventory; server/CI secret placeholders must stay empty.
- Real `.env.local`/`.env.production` are ignored and never committed.
- Run `npm run env:placeholders:check` and remove server secret values/names from renderer config rather than expanding the allowlist blindly.

## Windows package `EPERM` rename error

Stale Picom Vite/Electron or Explorer/antivirus can lock `release/win-unpacked.tmp`.

1. Close verified Picom project processes/windows.
2. Confirm the temporary target resolves inside the Picom repository.
3. Remove only the incomplete `.tmp` output when no process uses it.
4. Rerun `npm run package:win`.

Never recursively delete an unverified path or kill unrelated Electron processes.

## Vite chunk warning over 500 kB

Current build passes but warns about large main/LiveKit chunks. Treat as non-blocking beta issue until measured against `docs/performance-budget.md`. Use safe lazy loading/code splitting in a dedicated performance task; do not remove required functionality or hide the warning.

## Supabase/private attachment does not render after reload

The bucket is private and upload preview uses a temporary signed URL that is not persisted. Historical signed-URL refresh is an explicit stable blocker. Do not make the bucket public or store long-lived signed URLs as a workaround. Implement an authenticated resolver and verify expiry/access-loss/private-channel behavior.

## LiveKit join fails

- Confirm Supabase session, voice channel type/access, `VITE_LIVEKIT_ENABLED`, public URL, and deployed `livekit-token` Function.
- Server-only `LIVEKIT_URL`, API key, and API secret belong in Function secret storage.
- Run `npm run livekit:smoke`; then test the deployed Function with redacted errors.
- Do not generate tokens in renderer or log returned tokens.

## Microphone or screen share fails

- Windows: check desktop-app microphone/privacy settings.
- Linux: record X11/Wayland, audio stack, PipeWire, and xdg-desktop-portal backend.
- macOS: enable Picom under Microphone/Screen Recording and restart when required.
- Source enumeration must happen only after explicit user action through preload IPC.
- Never log thumbnails, screen frames, audio, device IDs, or tokens.

## Build works but target package is unverified

Windows build does not prove Linux/macOS packaging; configuration smoke does not prove native install/permissions/signing. Use native protected hosts and platform runbooks, and mark missing evidence `Not run`/`Blocked` rather than pass.

## Unexpected working-tree files

Do not revert/delete unknown changes. Keep task commits scoped with exact `git add` paths. Local temp/log/release/env files must stay untracked/ignored; inspect ownership before cleanup.

## Getting support

Use Settings diagnostics/feedback to export redacted context. Include version/channel/platform/environment, exact command, error, and reproduction steps. Never send passwords, tokens, authorization headers, `.env` files, private keys, signed URLs, or unnecessary private content.
