# Task 376 - Localization QA TR/EN

## Scope

Prepared the English and Turkish localization QA process for the Picom desktop MVP without changing runtime UI.

## Completed

- Added a dedicated localization QA document for English and Turkish.
- Covered core MVP desktop surfaces, overlays, errors, Turkish overflow checks, and copy rules.
- Added a focused smoke test to ensure the localization QA document keeps the required desktop surfaces and constraints.

## Validation

- `npm run localization:qa:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- This task is documentation-first and does not implement a full i18n extraction.
- Remaining i18n gaps are explicitly listed for future localization implementation.
