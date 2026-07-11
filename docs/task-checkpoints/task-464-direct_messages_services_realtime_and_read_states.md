# Task 464 Checkpoint: Direct Messages Services, Realtime, and Read States

## Scope completed

- Added cursor-based DM message and shared-media pages.
- Separated conversation summaries from active message loading.
- Completed idempotent send, reply metadata, edit/delete RPC, reactions, attachment metadata, mark-read, mute, and archive services in mock and Supabase modes.
- Replaced all-conversation content channels with an active-conversation subscription plus a lightweight list/read-state subscription.
- Added realtime attachment/read-state handling, bounded event deduplication, deterministic cleanup, and unread reconciliation.
- Kept renderer components behind service callbacks.

## Validation contract

- `npm run dm:services:realtime:smoke`
- `npm run dm:schema:completion:smoke`
- `npm run dm:production:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

## External evidence

The migration and two-window checklist are hosted-ready. Live two-client Supabase Realtime and pgTAP evidence is BLOCKED until a non-production project and Supabase CLI/credentials are available; no hosted success is inferred from local structural checks.

## Observed local results

- PASS: DM services realtime smoke
- PASS: DM schema completion smoke
- PASS: DM production smoke after replacing stale fixed-limit/all-conversation assertions with cursor and active-subscription assertions
- PASS: TypeScript typecheck
- PASS: Mock mode smoke
- PASS: Supabase schema structural smoke
- PASS: Supabase RLS structural smoke
- PASS: Production renderer and Electron build
- PASS: Picom QA smoke gate
- PASS: Renderer performance hard caps (`initialJs 1546.9 KiB`, `initialCss 229.6 KiB`, `totalAssets 3004.1 KiB`)
- BLOCKED: live pgTAP and two-client Supabase Realtime evidence because the Supabase CLI/staging credentials are unavailable

## Remaining boundary

Attachment binary upload remains owned by the private Storage upload service; this task persists and synchronizes DM attachment metadata only. Supabase Realtime performs transport reconnection, while Picom guarantees React subscription cleanup and event deduplication.
