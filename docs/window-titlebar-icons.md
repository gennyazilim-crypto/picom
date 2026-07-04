# WindowTitleBar icon mapping

Task 052 confirms WindowTitleBar icons are rendered through `AppIcon` and backed by the MVP semantic icon map.

## Mapped icons

- Search: `mvpUiIconMap.windowTitleBar.search`
- Minimize: `mvpUiIconMap.windowTitleBar.minimize`
- Maximize: `mvpUiIconMap.windowTitleBar.maximize`
- Close: `mvpUiIconMap.windowTitleBar.close`
- Theme toggle: handled by `ThemeToggle`, which uses `AppIcon` for sun/moon.

## Accessibility

Window control buttons keep explicit `aria-label` values. Icons remain decorative inside the buttons.