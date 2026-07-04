# Theme persistence placeholder

Picom keeps the MVP theme switch local-first and desktop-safe.

## Current behavior

- `ThemeToggle` is the shared UI control for light/dark switching.
- The active theme is stored through `settingsService` in localStorage under the existing Picom settings key.
- `App` applies the theme by setting `document.documentElement.dataset.theme`.
- Theme colors come from design tokens in `src/styles.css`.

## Future backend path

When user accounts are connected to Supabase, the same theme value can be synced to a profile/settings table. The local value should remain the first paint fallback so the desktop shell does not flash the wrong theme on startup.

## Safety notes

- No native desktop APIs are called from the React component.
- The toggle uses only Coolicons through `AppIcon`.
- No mobile layout or advanced roadmap feature was added.