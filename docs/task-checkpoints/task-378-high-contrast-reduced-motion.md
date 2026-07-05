# Task 378 - High Contrast and Reduced Motion

## Scope

Added local desktop accessibility display preferences for high contrast, reduced motion, larger text, and stronger focus rings.

## Completed

- Extended `settingsService` with persisted accessibility settings.
- Added root dataset flags for accessibility preferences.
- Added Settings > Appearance controls.
- Added CSS token overrides for high contrast, reduced motion, larger text, and focus ring strength.
- Documented manual QA steps and limitations.
- Added a focused smoke test.

## Validation

- `npm run accessibility:display:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- No mobile layout or redesign was introduced.
- Preferences are local-only for MVP and can be server-backed later.
