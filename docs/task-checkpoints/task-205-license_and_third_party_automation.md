# Task 205 checkpoint: License and third-party automation

## Delivered

- Added a dependency-free deterministic lockfile license inventory generator.
- Added generate/check npm commands and CI drift/policy verification.
- Added the generated report as a review artifact.
- Preserved the manual Coolicons CC BY 4.0 attribution and explicit free-only rule.
- Documented that automation does not replace legal, asset-rights, or release-artifact review.

## Validation

- `npm run licenses:generate`
- `npm run licenses:check`
- `npm run licenses:smoke`

App typecheck/build are not required because this task changes only release tooling, CI, and documentation; renderer/Electron runtime code is unchanged.
