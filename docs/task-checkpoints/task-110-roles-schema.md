# Task 110 checkpoint - Roles table schema

## Completed

- Added role validation constraints for name, color, hierarchy level, and permission metadata.
- Replaced the CSS-token database default with a portable Picom palette hex value.
- Added case-insensitive per-community role name uniqueness.
- Added community/level lookup index and documentation.

## Changed files

- `supabase/migrations/20260704000500_roles_schema.sql`
- `docs/roles-table-schema.md`
- `docs/task-checkpoints/task-110-roles-schema.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This task only affects Supabase schema and documentation. The existing MVP desktop UI remains unchanged.