# Global navigation current-state audit

Audit date: 2026-07-12  
Scope: authenticated renderer shell before Tasks 608-616  
Method: read-only source audit; no product source was changed

## Executive finding

Picom does not currently have a global authenticated navigation model. `App.tsx` owns a flat `activeView` union and mounts the existing `ServerRail` before every authenticated view branch. The rail mixes application routes, community switching, account utilities, and discovery. This conflicts with the approved model in which a new global sidebar owns application destinations and the existing ServerRail exists only inside Communities.

The current authenticated state initializes to `community`, not Feed. First-run onboarding completion explicitly opens `mentionFeed`, but ordinary login, session restore, and application relaunch do not apply one authoritative Feed landing policy.

## Current route and shell ownership

| Concern | Current owner | Current behavior | Gap for Tasks 608-616 |
| --- | --- | --- | --- |
| Authenticated route state | `src/App.tsx` local `activeView` state | Union includes community shell views plus `mentionFeed`, `profile`, `directMessages`, `friends`, `savedMessages`, and `discovery` | No typed global route store or route metadata |
| Default authenticated view | `useState<ActiveView>("community")` | Community opens by default unless a later handler changes it | Must always land on Feed after login/session/onboarding/relaunch |
| Main authenticated shell | `DesktopAppShell` + `desktop-frame` in `App.tsx` | Titlebar then one flex row | Needs global sidebar as the first authenticated column |
| Existing ServerRail | Unconditionally mounted in `desktop-frame` | Visible in Feed, Discovery, Profile, Saved, DM, Friends, Radio, Podcasts, and Community views | Must mount only for the Communities workspace |
| Community workspace | `ServerRail`, `CommunitySidebar`, content, optional `MemberSidebar` | Community rail is also acting as global navigation | Must become Global Sidebar -> ServerRail -> CommunitySidebar -> CommunityMain -> optional MemberSidebar |
| Overlay state | App-local settings/context/modal state | Settings is a modal rather than a global route | Can remain an overlay, but only the global Settings item may open it |

## Current `activeView` facts

The renderer currently recognizes these effective destinations:

- `community`, `radioCommunity`, and `podcastCommunity` through the community-kind shell.
- `mentionFeed`, labeled as Home or mention feed in several entry points.
- `directMessages`.
- `profile`.
- `friends`.
- `savedMessages`.
- `discovery`.

There are no first-class global `feed`, `communities`, `radio`, `podcasts`, `events`, `bookmarks`, `settings`, or `helpSupport` route identifiers. Radio and Podcasts are community-kind views; Events are community-owned; Bookmarks map to `savedMessages`. Route strings and transition handlers are distributed throughout `App.tsx`, command-palette actions, native menu actions, deep-link handlers, cards, search results, notifications, and profile activity.

## Landing behavior audit

| Flow | Actual behavior before Task 609 | Required behavior |
| --- | --- | --- |
| Fresh component/authenticated shell | `activeView` starts as `community` | Feed |
| Login | Authentication makes the existing App state render; no canonical Feed reset was found | Feed |
| Registration | Auth flow proceeds to policy/onboarding checks; no shared route policy owns the transition | Feed after required onboarding |
| Onboarding completion | Explicitly calls `setActiveView("mentionFeed")` | Feed, through the shared route policy |
| Session restore | No route reset effect was found; initial `community` wins on relaunch | Feed |
| Valid-session application relaunch | Initializes to `community` | Feed |
| Manual navigation after landing | Distributed `setActiveView` calls | Typed route service/store |

Remembered community/channel/DM state exists in feature services and App state, but it is not separated from the authenticated landing decision.

## Current ServerRail inventory

`src/components/ServerRail.tsx` currently contains:

- Picom logo button labeled “Open mention feed”.
- Direct Messages button.
- Community icon stack.
- Add community button.
- Discover communities button.
- Log out button.
- Settings button.

The component calls the logo destination `homeActive`, and `App.tsx` maps it to `mentionFeed`. One community unread dot is hardcoded to the `aurora` ID rather than driven by unread state. No global Radio, Podcasts, Events, or Bookmarks items exist. Settings and Logout are mixed into this community rail.

## Settings entry-point inventory

Current ways that can invoke App-level `openSettings` include:

- ServerRail footer Settings button.
- CommunitySidebar bottom `UserMiniCard` display-name button.
- CommunitySidebar bottom `UserMiniCard` Settings icon.
- Full Profile “Edit profile” and verification actions.
- Profile context-menu actions for the current user.
- App/native menu Settings actions.
- Keyboard/command-palette settings actions routed through App handlers.
- Safe-mode, diagnostics, permission, and account flows that route into a requested Settings section.

`SettingsModal` also receives active-community context for developer portal capabilities and community collections for mute/account ownership behavior. Tasks 608 and 612 must distinguish genuinely user-owned settings from community administration without breaking account, privacy, notification, diagnostics, or developer tools.

## Help and Support entry-point inventory

- Native/app menu actions `open-help` and `open-about` currently call `openSettings`.
- The handler displays a raw MVP message stating Help/About is a placeholder kept in Settings.
- Settings contains feedback, diagnostics, logs, and account-support surfaces, but there is no dedicated typed Help & Support destination.
- No exclusive global Help & Support item exists.

Task 613 must create one truthful support surface and remove duplicate or placeholder launch paths without removing diagnostics and feedback capabilities.

## Community Settings ownership

The role-aware Community Header/Menu path already owns community administration:

- `CommunityMenu` opens `CommunityAdminPanel` for owner/admin access.
- `CommunityModeratorPanel` is permission-gated separately.
- `CommunityAdminSections` owns the Community Settings editor.
- Community roles, members, moderation, channels, invites, verification, events, Radio, and Podcast administration remain community-scoped.

This is the correct product boundary. Task 612 must ensure user Settings never becomes an alternate community-admin launcher and must remove global user-setting entry points from CommunitySidebar/UserMiniCard.

## Profile and logout entry points

Profile opens from member/message/feed/story/DM/search/profile-popover and activity surfaces through App profile handlers. The CommunitySidebar `UserMiniCard` does not open the profile; its main identity button currently opens Settings.

Logout is reachable from:

- ServerRail footer.
- Settings account/security flows.
- App lock screen.
- legal re-acceptance prompt.
- account deletion completion.
- native/app menu or auth-service actions wired to `handleLogout`.

`CommunitySidebar` passes an `onLogout` prop to `UserMiniCard`, but the rendered mini card has no logout button. This is dead/duplicated API surface.

## Presence audit

There are two separate presence paths:

- `friendPresenceService` publishes and reads friend presence through `set_my_friend_presence` and `list_friend_presence`, with a mock fallback, heartbeat, share-presence option, and delayed offline cleanup.
- `useSupabasePresenceChannel` publishes community-scoped realtime presence and maps connection state for the active community.

`UserMiniCard` simply renders the active community `Member.status/statusText`; it is not backed by one global current-user presence store. There is no global presence selector for Online, Idle, Do Not Disturb, and Invisible. Invisible is not modeled as a first-class UI preference whose public projection is Offline. Task 610 must consolidate current-user preference, connection-derived effective state, backend projection, and global card behavior while preserving community/friend readers.

## Badge and notification source audit

| Badge | Existing source | Current integration gap |
| --- | --- | --- |
| DM unread | `DirectConversation.unreadCount`, Supabase direct-message service, realtime reconciliation | Not aggregated onto a global DM item |
| Community unread/mentions | App unread state, message realtime, `markChannelUnread`/`clearChannelUnread`, read-state service | ServerRail uses a hardcoded community dot; no global Communities total |
| Notification inbox | `notificationCenterService` local/remote inbox and WindowTitleBar unread count | No global notification/badge projection service |
| Radio live | Radio session/community services | No global Radio live badge |
| Events | Community events and `eventReminderService` | No global upcoming/unread badge |
| Bookmarks | `savedMessageService` / Saved Messages view | No global item or count |

Task 615 needs a derived badge store that consumes existing owners rather than introducing duplicate unread truth.

## Deep-link and command audit

`App.tsx` currently handles deep links and native menu actions directly. Supported transitions include community/channel, invite, Radio session, Podcast episode, Friends, Mention Feed, DM, Settings, and notification targets. Some native actions still emit “foundation” or placeholder copy. Search and command-palette actions call `setActiveView` directly. Tasks 609 and 615 must normalize these into typed route intents while preserving permission checks and message highlighting.

## Responsive and accessibility audit

- The desktop shell enforces `min-width: 1100px` and shows a desktop warning below it.
- The existing ServerRail is fixed at 72px and CommunitySidebar at 260px.
- No global 208-220px full sidebar exists.
- No global 68-76px compact breakpoint or persisted compact preference exists.
- The current rail is icon-only and has aria labels/titles, but it is not a responsive variant of a full navigation system.
- Focus-visible and reduced-motion foundations exist globally, but compact tooltips, roving navigation, badge announcements, and user-card keyboard behavior are not defined.

Task 614 must remain desktop-adaptive and must not introduce a mobile navigation pattern.

## Raw placeholders and dead paths

- Native Help/About explicitly reports a placeholder in Settings.
- Several native/command actions use “foundation” copy rather than route metadata.
- Friends still carries local-beta wording in command metadata.
- ServerRail community unread is hardcoded.
- `UserMiniCard.onLogout` is passed but not rendered.
- `homeActive`/`onOpenHome` terminology survives even though Feed is the approved destination.
- Settings/Profile/Help transitions are spread across local callbacks rather than one navigation service.

## Dependency map for Tasks 608-616

| Task | Primary existing dependencies | Required result |
| --- | --- | --- |
| 608 | `App.tsx`, `DesktopAppShell`, `ServerRail`, design tokens, AppIcon | Add one global sidebar shell and route items without duplicating feature views |
| 609 | App `activeView`, auth/session/onboarding services, deep links, command palette | Typed route model; Feed after every authenticated entry flow |
| 610 | `friendPresenceService`, community presence hook, settings/profile data, auth service | Canonical current-user presence preference/effective state and global user card |
| 611 | App render branches, existing ServerRail/CommunitySidebar, community-kind routing | ServerRail only inside Communities; preserve text/Radio/Podcast community behavior |
| 612 | Settings state/modal, UserMiniCard, ServerRail, CommunityHeader/Menu/Admin panels | Global-only User Settings; community-only role-aware administration |
| 613 | native menu service, feedback/diagnostics/log services, Settings support content | Dedicated truthful Help & Support destination, exclusively launched globally |
| 614 | shell CSS, 1100px warning, accessibility settings, tooltip/focus primitives | 208-220px full and 68-76px compact desktop sidebar with keyboard/tooltips |
| 615 | DM unread, App unread state, notification center, Radio sessions, events, saved messages, deep links | Derived badges and typed deep-link route intents without duplicate truth |
| 616 | feature-specific smoke tests, visual/E2E contracts, performance, license/security gates | Final local QA plus truthful hosted/native blockers |

## Migration risks

- `App.tsx` is a large state owner with many direct route writes; a single large rewrite would create hook/order and regression risk.
- The working tree contains concurrent user-owned UI/Iconix changes. Task commits must stage only their exact hunks/files.
- Global navigation must not remount expensive feature services on every route change.
- Moving ServerRail can alter width assumptions in Feed, DM, Profile, Meeting, Radio, and Podcast layouts.
- A Feed landing reset must run only at authenticated-entry boundaries, not on every render or manual route change.
- Presence must not leak Invisible users or trigger duplicate heartbeats/channels.
- Badge derivation must not mark private/inaccessible content as visible.

## Audit conclusion

Task 607 is complete as a factual read-only audit. Product source remains unchanged. Tasks 608-616 should extend the existing App feature views and service owners rather than create parallel Feed, DM, community, audio, settings, notification, or presence implementations.
