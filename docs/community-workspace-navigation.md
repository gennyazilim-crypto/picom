# Community workspace navigation

The authenticated global sidebar owns Feed, Direct Messages, Communities, Radio, Podcasts, Events, Bookmarks, Settings, and Help and Support. The 72px `ServerRail` is a nested community switcher, not a second global navigation system.

## Mount contract

- `ServerRail` mounts only inside `CommunityWorkspace` for the text-community route.
- Feed, Direct Messages, Radio, Podcasts, Events, Bookmarks, Discovery, Profile, Settings, and Support do not mount it.
- Selecting a text community keeps the rail and updates the active community/channel.
- Selecting an audio community opens its Radio or Podcast workspace and removes the nested rail.
- Add Community and Discover Communities remain community-scoped rail actions.

## Settings ownership

- User Settings exists only in the global sidebar.
- Help and Support exists only in the global sidebar.
- Community settings and administration exist only under Community Header -> Community Menu with role-aware permissions.
- The community mini card retains local mute/deafen controls but no Settings or logout action.

## Desktop width

`CommunityWorkspace` is a clipped flex row with `min-width: 0`. The global sidebar already switches from 216px to 72px at the medium desktop breakpoint, preserving the nested 72px community rail and chat columns without introducing mobile navigation.
