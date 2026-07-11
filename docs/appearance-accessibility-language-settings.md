# Appearance, Accessibility, and Language Settings

Picom stores visual preferences per desktop device. Theme can be Light, Dark, or System. System mode resolves through prefers-color-scheme and updates while the app is running. The pre-render bootstrap reads the same versioned settings before React starts, preventing a light/dark flash where the renderer permits.

Accessibility controls include high contrast, reduced motion, larger text, and a strong keyboard focus ring. Compact density reduces desktop spacing without changing fixed rails, minimum window size, or the four-column layout. Operating-system reduced-motion remains an additional safety layer.

English and Turkish are supported by the typed Picom catalog. The document language and all date/time helpers update immediately. Users may choose system, numeric, or descriptive dates and system, 12-hour, or 24-hour time. User-generated content is never translated.

These preferences are device-local by policy. They are versioned in settings schema v8, migrated from existing light/dark settings, guarded against corrupt local storage, and applied through semantic data attributes and design tokens.
