# QA Smoke Gate

`npm run qa:smoke` runs Picom's lightweight MVP safety checks without launching the desktop UI.

## Included checks

- diagnostics redaction smoke test
- unified error-code smoke test
- crash diagnostics smoke test
- mock mode smoke test

## Command

```powershell
npm run qa:smoke
```

## When to run

- after diagnostics/logging changes
- after auth/session changes
- after mock data/service changes
- before a beta smoke pass
- before packaging if a full build is not needed yet

## What it does not replace

- manual Electron launch verification
- Supabase mode smoke testing
- LiveKit voice/screen-share manual QA
- Windows/Linux/macOS package installation smoke tests
- full production build

## Safety expectation

The gate must not require secrets. It must not print Supabase service-role keys, LiveKit API secrets, signing keys, auth tokens, passwords, cookies, or authorization headers.
