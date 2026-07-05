# Secret Exposure QA

Picom must never ship production secrets in renderer, Electron preload, or Electron main process code.

## Command

```powershell
npm run secrets:smoke
```

`npm run qa:smoke` includes this check.

## Runtime files scanned

- `src/`
- `electron/`

## Blocked terms

- Supabase service-role keys
- LiveKit API secrets
- signing keys
- private keys
- raw auth token assignments
- raw password assignments
- raw cookie assignments
- raw authorization assignments

## Allowed exception

`src/services/loggingService.ts` may contain secret names only as redaction patterns. It must not contain real secret values.

## Manual QA

- Confirm `.env` files are not committed with real values.
- Confirm renderer code only uses public Vite variables such as Supabase URL and anon key.
- Confirm LiveKit server secrets stay outside the renderer.
- Confirm signing material is never placed in repository files.
