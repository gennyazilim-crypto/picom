# Task 341 - Localization QA extended

Status: extended QA and targeted runtime hardening completed; full runtime catalog remains intentionally unapproved.

## Delivered

- Kept the localization status honest: Picom has no complete central runtime catalog or language selector yet.
- Added dedicated truncating text/count spans for the long Turkish Mention Feed tab label.
- Preserved the full Turkish label through a title and kept the count visible at constrained desktop widths.
- Extended locale resolution to prefer `navigator.languages[0]`, validate the candidate through `Intl`, and fall back safely for malformed locale/timezone input.
- Expanded UTF-8, Turkish overflow, future pseudo-locale, legal-review and hardcoded-string exception guidance.
- Explicitly protected user-generated messages, names, bios, statuses, captions and moderation evidence from automatic translation.
- Added no mobile UI and no web-first layout.

## Validation

- `npm run localization:qa:smoke`
- `npm run localization:expansion:smoke`
- `npm run date-time:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining work

- Select/approve a central message-catalog runtime before claiming full EN/TR localization.
- Extract critical-path English source strings into typed keys and complete human-reviewed Turkish parity.
- Run pseudo-locale, Windows/Linux/macOS locale, visual overflow and accessibility QA on a release candidate.
- Legal/safety translations require qualified human and version-level approval.

