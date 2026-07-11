# Task 476 Checkpoint: Unified Text, Radio, and Podcast Mention Model

## Delivered

- Canonical source-aware mention type and navigation adapters.
- Mock fixtures spanning text messages, Radio sessions/chat, Podcast episodes, and Podcast comments.
- Service-layer pagination for mock and permission-filtered Supabase modes.
- `content_mentions` migration with source compatibility checks, edit/delete synchronization, backfill, forced RLS, and an invoker RPC.
- Static smoke and pgTAP contracts covering write denial and source-specific private access.

## Safety

- Existing Mention Feed and Audio card layouts are unchanged.
- Renderer clients cannot insert/update/delete normalized mention rows.
- Visibility is recalculated from the live source; the stored visibility context is presentation metadata only.
- Deleted, unpublished, inaccessible, or blocked sources are excluded.

## Commands

- `npm run mentions:unified:smoke`
- `npm run mentions:supabase:smoke`
- `npm run audio:mvp:qa`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Hosted pgTAP remains BLOCKED until Supabase CLI and staging credentials are available. No hosted RLS pass is claimed.
