# Task 322 - Expired Invites Cleanup Job

## Status

Completed.

## Summary

- Added an expired invite cleanup processor foundation.
- Added smoke coverage for expiration detection, dry-run behavior, adapter-based revocation, and missing adapter safety.
- Added a manual dry-run script with fixture data.
- Connected the processor to the background job queue smoke path.
- Documented the future Supabase invite cleanup implementation.

## Validation

- `npm run invites:cleanup:smoke`
- `npm run invites:cleanup:dry-run`
- `npm run jobs:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- The production invite table is not implemented yet.
- No production data is modified by the current dry-run script.
