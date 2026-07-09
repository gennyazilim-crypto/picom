# Task 14 - Legal / Policy MVP

## Status

Implemented product-level legal placeholders and beta acceptance UI.

## Delivered

- Required Terms and Privacy checkbox for email and social registration paths.
- In-app legal document modal with Escape and outside-click close behavior.
- Settings > Legal document index.
- Terms, Privacy, Community Guidelines, Acceptable Use, and legal-review-required documents.
- Explicit non-final, non-legal-advice labeling throughout.

## Deferred intentionally

- Durable `terms_accepted_at` and policy-version evidence await approved production schema and legal text.
- No tracking, cookies, or analytics were added.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
