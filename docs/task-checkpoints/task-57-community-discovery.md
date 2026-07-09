# Task 57 - Community Discovery MVP+

Date: 2026-07-10
Status: Complete

## Result
- Added discovery listing/category fields and a partial public-listing index.
- Added a desktop DiscoveryView from ServerRail with six category filters and View/Join actions.
- Local cards include only public communities; Supabase queries require public, public-read, and discovery-listed simultaneously and still rely on RLS.
- Join uses the existing membership service and returns to the community layout.

## Validation
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run build`
