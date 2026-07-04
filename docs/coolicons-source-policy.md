# Free Coolicons source policy

Picom uses Coolicons Free as the single approved UI icon source for the MVP desktop app.

## Approved source

- Icon set: Coolicons
- Creator: Kryston Schwarze
- License: CC BY 4.0
- Approved source repository: https://github.com/krystonschwarze/coolicons
- Approved Figma source: https://www.figma.com/community/file/800815864899415771/coolicons-free-iconset

## Rules

- Use only free Coolicons for MVP UI icons.
- Do not use Coolicons PRO unless a valid license is purchased and documented.
- Do not mix icon styles from other libraries.
- Do not add Discord icons, Discord logo, copied Discord assets, or exact Discord colors.
- Route runtime UI icons through `AppIcon` or a future approved icon registry.
- Icons must use `currentColor` so light/dark theme tokens control color.
- Icon-only buttons must include an accessible `aria-label`.

## Adding a new icon

1. Confirm the icon exists in the free Coolicons source.
2. Add it to the approved `AppIcon` registry.
3. Keep the SVG path theme-safe with `currentColor`.
4. Use one of the approved sizes: xs, sm, md, lg, xl.
5. Add or update accessibility labels wherever the icon is used without visible text.

## Release checklist reminder

Before beta release, audit `AppIcon` against the free Coolicons source and keep attribution in `THIRD_PARTY_NOTICES.md`.