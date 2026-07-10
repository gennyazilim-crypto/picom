# Task 382 Checkpoint: Setup Localization TR EN QA

## Result

Added typed English/Turkish first-launch copy, system-language defaulting, and an
in-setup language switch without translating user-generated content.

## Implemented

- English and Turkish copy source for all five setup steps.
- Localized progress, guide, buttons, hints, and accessibility labels.
- Long-label-safe desktop action/button styles.
- Smoke assertions for both language sets and locale wiring.
- Desktop fit and native-installer localization boundary documentation.

## Remaining boundary

This task does not provide full-app or native installer framework localization.
Windows/macOS/Linux native setup copy still needs target-host review.
