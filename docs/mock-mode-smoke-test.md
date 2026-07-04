# Mock Mode Smoke Test

Task 162 adds a small smoke test to make sure mock mode remains available while Supabase data mode is being connected.

## Command

```bash
npm run mock:smoke
```

## What it checks

The script verifies that the project still contains:

- mock community data
- mock auth session path
- mock community service path
- mock channel service path
- mock message service path
- mock members service path
- mock reactions service path
- Supabase-only startup data effects in `App.tsx`

## What it does not check

This script does not launch Electron and does not replace manual UI testing. It is a fast guard that mock mode has not been accidentally removed while connecting Supabase services.

## Manual verification

1. Set `VITE_DATA_SOURCE=mock` or leave the default mock mode.
2. Start the app.
3. Sign in with mock/dev credentials.
4. Switch communities and channels.
5. Send a message.
6. Confirm MemberSidebar search still works.