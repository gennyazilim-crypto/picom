# Task 607 checkpoint: Global navigation current-state audit

## Status

Complete. This task changed documentation only.

## Confirmed facts

- Authenticated `activeView` initializes to `community`.
- Onboarding completion alone explicitly opens `mentionFeed`; login/session restore/relaunch have no shared Feed landing policy.
- The existing ServerRail is mounted before all authenticated route branches and therefore appears outside Communities.
- Settings and Logout are mixed into ServerRail and community/user surfaces.
- Help/About currently routes to Settings with placeholder copy.
- Community Settings correctly lives behind CommunityHeader/CommunityMenu role checks.
- Presence is split between friend RPC presence and community realtime presence; no canonical global current-user presence owner exists.
- DM/community/notification/Radio/Event badge sources are not aggregated for global navigation.
- The shell has a 1100px desktop minimum but no full/compact global sidebar model.

## Dependency output

The exact owner and migration map for Tasks 608-616 is documented in `docs/global-navigation-current-state-audit.md`.

## Validation

- Product source modification: none.
- Hosted environment required: no.
- Runtime/build validation: not required for documentation-only audit.
- Concurrent user/Iconix working-tree changes: preserved and not staged.
