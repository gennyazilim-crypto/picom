# React Hook Order QA

Picom previously hit a renderer startup class of failures where auth/session state changed the render path before all hooks were registered. The `react:hooks:smoke` gate protects the critical `App.tsx` startup path.

## Covered behavior

- The protected auth/session guard in `App.tsx` stays after the main app hooks.
- Supabase realtime, typing, presence, local state, overlay state, member sidebar state, and protected session hooks remain registered before the early auth return.
- No hook calls appear after the auth early-return guard.
- `DesktopStartupErrorBoundary` still captures exceptions, records crash recovery state, and exposes redacted diagnostics.

## Commands

```bash
npm run react:hooks:smoke
npm run qa:smoke
```

## Notes

This is a focused source smoke test, not a replacement for ESLint's React Hooks plugin. It protects the highest-risk startup path without adding heavy tooling to the MVP.
