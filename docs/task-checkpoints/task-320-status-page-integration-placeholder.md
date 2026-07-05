# Task 320 - Status Page Integration Placeholder

## Status

Completed.

## Summary

- Added `VITE_STATUS_PAGE_URL` to renderer-safe config.
- Added `statusPageService` that opens only through `externalLinkService`.
- Added Settings > Advanced system status action.
- Added an app menu placeholder action for system status.
- Added a System status action to the maintenance screen.
- Documented configuration and safety behavior.

## Validation

- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- No real status page URL is committed.
- Unsafe URLs remain blocked by the centralized external link service.
