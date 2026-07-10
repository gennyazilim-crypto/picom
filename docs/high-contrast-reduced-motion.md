# High Contrast and Reduced Motion

Picom supports local desktop accessibility display preferences without changing the four-column MVP layout.

## Implemented settings

- High contrast mode.
- Reduced motion.
- Larger text.
- Strong focus ring.

These preferences are stored through `settingsService` in local desktop settings. They are exposed in Settings > Appearance.

## Runtime behavior

- `data-high-contrast="true"` strengthens borders, secondary text, muted text, hover surfaces, accent softness, and focus rings.
- `data-reduced-motion="true"` reduces animation/transition durations and delays, limits iteration, and disables smooth scrolling.
- The operating-system `prefers-reduced-motion: reduce` preference applies the same global motion reduction even before Picom has a saved local override.
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
4. Enable Larger text and verify the four-column desktop layout remains stable.
5. Enable Strong focus ring and tab through titlebar, sidebars, composer, settings, and context menus.
6. Repeat in light and dark themes.
7. Restart Picom and confirm all four preferences retain their saved values.
8. Enable the operating-system reduced-motion preference, restart Picom, and confirm non-essential motion remains reduced even when Picom's local toggle is off.

## Known limitations

- This internal finalization is not a WCAG/EN 301 549/Section 508 conformance claim; independent platform testing and measured contrast evidence remain required.
- Preferences are local to the current desktop installation. Cross-device account sync is intentionally not claimed.
- The root accessibility path is centralized, while independent keyboard/screen-reader verification remains tracked in the remediation checklist.
