# Coolicons build and visual QA

Task 060 records build verification and manual visual QA expectations for the Coolicons MVP icon system.

## Automated verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Vite production build completed with the current `AppIcon` and semantic icon registry.

## Visual QA checklist

Run `npm run dev`, then inspect:

- WindowTitleBar search, theme toggle, minimize, maximize, and close icons.
- ServerRail add, discover, and settings icons.
- CommunitySidebar category, text channel, voice channel, lock, mute, deafen, and settings icons.
- ChatHeader channel, pinned, notification, inbox, members, search, and more icons.
- MessageComposer attach, emoji, send, close preview, and image/drop hint icons.
- MemberSidebar search icon.
- Settings and ImagePreview close icons.
- CommandPalette search icon.

## Pass criteria

- Icons inherit light/dark colors through `currentColor`.
- Icons align visually with surrounding text and controls.
- Icon-only buttons have accessible labels.
- No mixed icon library styles appear.
- No Discord icon, logo, branding, copied asset, or exact Discord color appears.