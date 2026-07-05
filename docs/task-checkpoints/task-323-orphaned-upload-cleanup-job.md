# Task 323 - Orphaned Upload Cleanup Job

## Status

Completed.

## Summary

- Added an orphaned upload cleanup processor foundation.
- Added smoke coverage for orphan detection, dry-run behavior, safe delete adapters, metadata marking adapters, and missing adapter safety.
- Added a manual dry-run script with fixture data.
- Connected the processor to the background job queue smoke path.
- Documented production constraints and future Supabase adapter requirements.

## Validation

- `npm run uploads:cleanup:smoke`
- `npm run uploads:cleanup:dry-run`
- `npm run jobs:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- Existing valid message attachments remain protected by the orphan detection rules.
- No production files are deleted by the current dry-run script.
