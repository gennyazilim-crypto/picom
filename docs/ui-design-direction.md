# Reference Image UI Design Direction and Originality Rules

Picom should follow the uploaded reference image in quality, desktop structure, density, and polish while remaining an original product with its own brand, palette, icons, and visual identity.

## Design direction

- Premium desktop community chat interface.
- Fixed, stable desktop layout instead of mobile-first responsiveness.
- Soft rounded app frame and panels.
- Compact but readable spacing.
- Calm light mode and rich dark mode.
- Clear 4-column hierarchy: server rail, community sidebar, chat main, member sidebar.
- Independent chat scrolling with pinned composer.
- Fixed sidebars with no page-level horizontal overflow.

## Originality rules

- Do not use Discord branding.
- Do not use Discord logos, icons, copied assets, or exact colors.
- Do not copy the reference image pixel-for-pixel.
- Use Picom's own logo, Coolicons Free icons, and approved brand palette.
- Keep interaction patterns familiar for desktop chat, but make all visual choices original.

## Design token requirements

Core UI surfaces must use tokens for:

- colors
- text colors
- backgrounds
- borders
- radius
- shadows
- focus states
- status colors
- spacing rhythm where practical

Components should not introduce random hardcoded colors. If a new visual state is needed, add or reuse a token first.

## Layout requirements

- Main target viewport: 1440x900.
- Minimum usable viewport: 1100x700.
- No mobile navigation.
- No bottom tabs.
- No web-first stacked layout.
- No horizontal overflow.
- Server rail stays fixed.
- Community sidebar stays fixed.
- Member sidebar stays fixed and can be hidden only by desktop control.
- Chat message list scrolls independently.
- Composer remains pinned at the bottom of chat.

## Quality bar

A change is acceptable only if it preserves:

- polished light and dark mode
- readable typography hierarchy
- aligned icon system
- stable app frame
- compact sidebar density
- clear hover, active, and focus states
- original Picom visual language

## Review checklist for future UI work

- Does it preserve the 4-column desktop structure?
- Does it avoid mobile UI?
- Does it use Picom tokens?
- Does it use Coolicons only?
- Does it avoid Discord assets and exact colors?
- Does it keep sidebars fixed and chat independently scrollable?
- Does it feel native to Windows/Linux/macOS desktop use?