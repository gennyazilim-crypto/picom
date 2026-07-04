# MVP UI icon map

Task 051 maps MVP desktop UI surfaces to approved Coolicons through the semantic registry.

## Surface map

| Surface | Product meaning | Registry key |
| --- | --- | --- |
| WindowTitleBar | Search | `windowTitleBar.search` |
| WindowTitleBar | Theme toggle | `windowTitleBar.lightTheme` / `windowTitleBar.darkTheme` |
| WindowTitleBar | Window controls | `windowTitleBar.minimize`, `maximize`, `close` |
| ServerRail | Home | `serverRail.home` |
| ServerRail | Add community | `serverRail.addCommunity` |
| ServerRail | Discover | `serverRail.discover` |
| ServerRail | Settings | `serverRail.settings` |
| CommunitySidebar | Text channel | `communitySidebar.textChannel` |
| CommunitySidebar | Voice channel | `communitySidebar.voiceChannel` |
| CommunitySidebar | Private channel | `communitySidebar.privateChannel` |
| ChatHeader | Pinned, notifications, inbox, members, search, more | `chatHeader.*` |
| MessageComposer | Attach, emoji, send, image, close | `messageComposer.*` |
| MessageItem | Reply, react, more | `messageItem.*` |
| MemberSidebar | Search/profile placeholder | `memberSidebar.*` |
| Overlays | Close/search | `overlays.*` |

## Notes

- The map is typed in `src/components/iconRegistry.ts`.
- Values resolve to `IconName` and must remain backed by `AppIcon`.
- This task does not introduce a second icon system.