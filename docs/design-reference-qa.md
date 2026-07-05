# Design QA Against Reference

Picom is a premium Electron desktop community chat app. This QA checklist keeps the UI aligned with the uploaded reference direction while preserving Picom's own identity, palette, logo, and Coolicons icon system.

## Reference intent

- Four-column desktop chat structure: ServerRail, CommunitySidebar, ChatMain, MemberSidebar.
- Soft rounded desktop frame with subtle border and shadow in normal window mode.
- Flush, edge-to-edge frame in maximized mode.
- Compact spacing, fixed sidebars, independently scrolling chat and lists.
- Complete light and dark modes using Picom design tokens.
- Original Picom colors: teal, aqua, rust, orange, brown.
- No Discord branding, logo, copied assets, icons, or exact color values.

## Current source anchors

- Shell/frame: `src/components/DesktopAppShell.tsx`
- App chrome: `src/components/WindowTitleBar.tsx`
- Primary layout styles: `src/styles.css`
- Design tokens: `src/styles.css`
- Icon system: `src/components/AppIcon.tsx`
- Branding guard: `scripts/branding-smoke-test.mjs`
- Desktop-only guard: `scripts/desktop-only-smoke-test.mjs`

## QA checklist

- App opens at 1440x900 with no horizontal page scroll.
- Minimum usable width remains 1100px.
- Narrow windows show only the desktop optimization warning, not a mobile layout.
- ServerRail width remains 72px.
- CommunitySidebar width remains 260px.
- MemberSidebar width remains 280px.
- ChatMain fills remaining width.
- Sidebars stay fixed while MessageList scrolls independently.
- Composer remains pinned at the bottom of ChatMain.
- Normal window mode uses the rounded premium frame.
- Maximized mode removes outer frame padding, radius, and large shadow.
- Titlebar is visually integrated with the frame.
- Search/theme/window-control buttons remain clickable and no-drag.
- Light mode uses soft cool gray/white surfaces with readable dark text.
- Dark mode uses charcoal surfaces, not pure black.
- Picom palette colors are present only through design tokens.
- Icon-only buttons use AppIcon/Coolicons and have accessible labels where applicable.
- Context menus, modals, image preview, and profile popover stay inside the desktop viewport.
- No bottom navigation, mobile drawer, breakpoint-driven mobile layout, or web-first page scrolling appears.

## Manual visual pass

1. Start Electron dev mode.
2. Check normal window at 1440x900.
3. Maximize and restore the window.
4. Toggle light/dark mode.
5. Switch communities and channels.
6. Open Settings, context menu, profile popover, and image preview.
7. Resize below 1100px and confirm the desktop warning appears.
8. Confirm no Discord branding or copied assets are visible.

## Automated supporting checks

```bash
npm run desktop:smoke
npm run branding:smoke
npm run qa:smoke
npm run build
```

## Known visual risks to watch

- Bundle-size work may later encourage lazy loading; ensure it does not cause layout flash.
- Large feature surfaces should not add mobile breakpoints.
- New icons must be mapped through AppIcon/Coolicons before use.
- Future Supabase/LiveKit loading states must preserve fixed desktop shell dimensions.
