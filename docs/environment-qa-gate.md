# Environment QA Gate

Picom uses Vite environment variables in the Electron renderer, so only public renderer-safe values belong in `.env.example` files.

## Covered behavior

- `.env.example` and `.env.beta.example` exist.
- `.env` and `.env.local` are ignored by git.
- Server-only values such as Supabase service-role keys, database URLs, LiveKit API secrets, JWT secrets, passwords, cookies, signing keys, and private keys are not defined in renderer env examples.
- The default local environment remains `VITE_DATA_SOURCE=mock`.
- `src/config/appConfig.ts` reads only `VITE_` variables.

## Commands

```bash
npm run env:smoke
npm run qa:smoke
```

## Notes

Supabase anon keys and public URLs are renderer-safe only when Row Level Security is correctly enabled. Service-role keys and LiveKit API secrets must stay server-side.
