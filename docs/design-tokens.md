# Design Tokens

Picom uses CSS variables as the design token layer for the premium desktop UI.

## Token groups

- Brand palette: Picom teal, aqua, rust, orange, and brown.
- Surface colors: outer background, frame, title bar, sidebars, chat, elevated surfaces.
- Text colors: primary, secondary, and muted.
- Interaction colors: accent, success, warning, danger, focus ring.
- Radius: small through frame radius.
- Spacing: compact desktop rhythm.
- Layout widths: server rail, community sidebar, member sidebar, desktop minimum size.
- Motion: subtle fast desktop transitions.

## Rules

- Prefer existing tokens before adding new visual values.
- Do not introduce random hardcoded colors in core UI components.
- Keep light and dark mode parity.
- Do not use Discord colors or assets.
- Preserve the fixed desktop chat shell and no-mobile direction.