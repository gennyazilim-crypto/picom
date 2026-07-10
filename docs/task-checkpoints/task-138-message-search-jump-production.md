# Task 138 - Message Search Jump Production

## Result

Completed for the current local search UI. Deleted messages are excluded, click-time community/channel/message access is revalidated, private channels remain filtered, valid targets switch/scroll/highlight, and stale/deleted/inaccessible targets fail generically without empty-channel navigation.

## Changed files

- `src/services/advancedSearchService.ts`
- `src/App.tsx`
- `docs/search/message-search-jump-production.md`
- `docs/task-checkpoints/task-138-message-search-jump-production.md`

## Verification

- `npm run message:search-jump:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Remote search is not connected to the palette; a bounded RLS-protected historical context endpoint and live Supabase tests remain required before unloaded remote result jumps are enabled.
