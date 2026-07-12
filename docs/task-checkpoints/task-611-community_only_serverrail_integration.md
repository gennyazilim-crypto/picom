# Task 611 checkpoint: Community-only ServerRail integration

## Completed

- Added `CommunityWorkspace` as the owner of the nested community rail and community columns.
- Removed the unconditional authenticated-shell ServerRail mount.
- Scoped ServerRail to the text Communities workspace only.
- Preserved community selection, context menus, Add Community, and Discover Communities.
- Removed Feed, Direct Messages, Settings, Help, and logout behavior from ServerRail.
- Removed the duplicate Settings action from CommunitySidebar and UserMiniCard.
- Preserved Community Header -> Community Menu as the sole community administration path.
- Reused the existing medium-desktop compact global-sidebar breakpoint without adding mobile UI.

## Validation

- `node scripts/community-only-serverrail-smoke.mjs`
- `node scripts/global-navigation-shell-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- visual/E2E contracts and renderer performance budget
