# Task 307 - Support diagnostics UX final

## Result

- Diagnostics snapshot/export includes Picom version/channel/build, desktop platform/runtime, data source, auth, Supabase configuration state, realtime state, active voice state, recent errors, and bounded redacted logs.
- Copy uses the same redacted JSON export contract as file export.
- Settings > Diagnostics retains feedback, snapshot, logs, copy, export, clear, and filters.
- Settings > Advanced now includes a direct Support diagnostics entry.
- Fixed corrupted separator/multiplication glyphs in the diagnostics summary.
- Active community/channel IDs remain omitted from exported service status; secrets, tokens, passwords, cookies, auth headers, service-role keys, private keys, and LiveKit secrets remain redacted/excluded.

## Validation

- `npm run support:diagnostics:final:test`
- `npm run diagnostics:smoke`
- `npm run logs:smoke`
- `npm run secrets:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

Open Settings > Advanced > Open diagnostics, refresh the snapshot, copy it, export it, inspect the files for sensitive values, and verify realtime/voice/error status reflects current state. Browser fallback may report native export unavailable but must not crash.
