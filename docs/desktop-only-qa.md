# Desktop-only QA

Picom is a Windows, Linux, and macOS desktop app. The MVP must not introduce mobile UI, mobile navigation, or web-first responsive layouts.

## Command

```powershell
npm run desktop:smoke
```

`npm run qa:smoke` includes this check.

## Blocked runtime patterns

- bottom mobile navigation
- mobile nav/header/layout classes
- hamburger menus
- touch-only UI paths
- small mobile breakpoints below the desktop minimum

## Allowed behavior

- desktop minimum-size warning
- fixed desktop sidebars
- independent chat scrolling
- pinned desktop composer
- maximized and normal desktop frame behavior

## Manual QA

- Open the app at 1440x900.
- Resize near 1100x700.
- Confirm the desktop warning appears below minimum width.
- Confirm no mobile bottom nav or single-column mobile layout appears.
