# High Contrast and Reduced Motion

Picom supports local desktop accessibility display preferences without changing the four-column MVP layout.

## Implemented settings

- High contrast mode.
- Reduced motion.
- Larger text placeholder.
- Strong focus ring placeholder.

These preferences are stored through `settingsService` in local desktop settings. They are exposed in Settings > Appearance.

## Runtime behavior

- `data-high-contrast="true"` strengthens borders, secondary text, muted text, hover surfaces, accent softness, and focus rings.
- `data-reduced-motion="true"` reduces animation and transition durations and disables smooth scrolling.
- `data-larger-text="true"` gently increases design token text sizes without introducing a mobile layout.
- `data-focus-ring-strong="true"` strengthens keyboard focus visibility.

## Design constraints

- The premium desktop shell remains unchanged.
- No mobile UI or responsive replacement is introduced.
- The Picom palette and design tokens remain the source of truth.
- Coolicons/AppIcon usage is unaffected.

## Manual QA

1. Open Settings > Appearance.
2. Enable High contrast mode and verify text, borders, hover states, and focus rings become clearer.
3. Enable Reduced motion and verify modal/popover transitions and smooth scrolling are reduced.
4. Enable Larger text placeholder and verify the four-column desktop layout remains stable.
5. Enable Strong focus ring placeholder and tab through titlebar, sidebars, composer, settings, and context menus.
6. Repeat in light and dark themes.

## Known limitations

- This is an MVP accessibility foundation, not a full WCAG audit.
- Per-user Supabase persistence can be added later if account settings become server-backed.
- Some older CSS blocks may still need future token cleanup, but the root accessibility path is now centralized.
