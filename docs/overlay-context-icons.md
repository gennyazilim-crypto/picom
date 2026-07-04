# Overlay and context menu icon mapping

Task 058 confirms overlay icons are rendered through `AppIcon` and backed by the MVP semantic icon map.

## Mapped icons

- Settings close button: `overlays.close`
- Image preview close button: `overlays.close`
- Command palette search icon: `overlays.search`

## Context menu note

The MVP context menu is text-only today. This task intentionally does not add new context menu icons because that would change density and visual behavior. If context menu icons are added later, they must use `AppIcon` and the semantic registry.

## Accessibility

Close buttons keep explicit `aria-label` values. The command palette search icon is decorative next to the focused text input.