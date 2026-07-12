# Task 608 checkpoint: Global app sidebar shell Full MVP

## Completed

- Added a typed global navigation registry with route, label, AppIcon, aria label, availability, and badge selector metadata.
- Added reusable GlobalNavItem and GlobalNavBadge components.
- Added GlobalAppSidebar with the approved Feed, DM, Communities, Radio, Podcasts, Events, and Bookmarks order.
- Added Settings, Help & Support, and the current user card in the bottom region.
- Added AuthenticatedAppShell and AppWorkspaceRouter boundaries around the existing authenticated workspaces.
- Connected navigation to existing Feed, DM, community-kind Radio/Podcast, Saved Messages, Settings, profile, and logout behavior.
- Added a real Upcoming Events workspace backed by existing accessible event data.
- Added desktop full and compact states without mobile navigation.
- Added a deterministic shell contract test.

## Deferred to later pack tasks

- Task 609 owns the canonical authenticated route store and Feed landing policy.
- Task 610 owns canonical current-user presence and backend persistence.
- Task 611 moves the existing ServerRail to Communities-only rendering.
- Task 612 removes duplicate Settings launch points.
- Task 613 promotes Help & Support from the existing Help Center surface to its exclusive route.
- Task 615 replaces provisional badge values with one derived badge service.

## Safety

- Existing feature workspaces and data services were reused.
- No Supabase call was added to a component.
- No Electron/preload/security behavior changed.
- No mobile UI, competitor branding, raw placeholder action, or new dependency was added.
