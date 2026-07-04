# CommunitySidebar icon mapping

Task 054 confirms CommunitySidebar icons are rendered through `AppIcon` and backed by the MVP semantic icon map.

## Mapped icons

- Community menu / expand: `communitySidebar.expand`
- Collapse: `communitySidebar.collapse`
- Text channel: `communitySidebar.textChannel`
- Voice channel: `communitySidebar.voiceChannel`
- Private channel: `communitySidebar.privateChannel`
- Mute: `communitySidebar.mute`
- Deafen: `communitySidebar.deafen`
- Settings: `communitySidebar.settings`

## Accessibility

Icon-only controls keep explicit `aria-label` values where they act as buttons. Channel rows include text labels, so the icons remain decorative.