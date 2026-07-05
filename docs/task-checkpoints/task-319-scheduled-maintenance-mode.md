# Task 319 - Scheduled Maintenance Mode

## Status

Completed.

## Summary

- Added a renderer maintenance status service.
- Added a desktop maintenance screen and degraded status banner.
- Extended the Supabase health Edge Function placeholder with safe maintenance fields.
- Documented the health response shape and production safety notes.

## Validation

- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- Mock mode remains unaffected.
- Maintenance mode is a safe foundation and does not add post-MVP operations tooling.
