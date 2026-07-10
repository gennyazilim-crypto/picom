# Task 342 - Time zone and event formatting final

Status: implemented and structurally verified.

## Delivered

- Confirmed messages, Mention Feed, profile activity, community events and community audit logs use `dateTimeService`.
- Migrated companion-rail events, community insights generation time, moderation metadata and redacted local logs from direct/raw formatting to the shared service.
- Kept system timezone as the default and explicit locale/timezone options available to callers.
- Replaced hardcoded English invalid-date/time copy with a language-neutral em dash.
- Added EN/TR and multi-timezone manual examples without changing stored UTC/ISO values.
- Extended the date/time smoke contract to cover all required and adjacent desktop surfaces.
- Added no mobile UI and did not translate user-generated content.

## Validation

- `npm run date-time:smoke`
- `npm run localization:qa:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining work

- Record packaged Windows/Linux/macOS examples under `en-US` and `tr-TR` with multiple system timezones.
- A future approved locale setting can pass its BCP 47 tag into the existing service; no language selector is currently claimed.
- Full catalog localization remains separate from date/time formatting.

