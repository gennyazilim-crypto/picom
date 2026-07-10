# Task 273 - Comment preview production model

## Outcome

- Approved reply-derived comments instead of a new social comment model.
- Added RLS-invoker counts, unique commenter IDs, and two compact previews to Mention Feed.
- Excluded deleted, blocked, thread, cross-channel, and inaccessible reply content.
- Added service/database type mapping without changing existing compact UI structure.
- Added static and isolated RLS coverage.

## Validation contract

- `npm run feed:comments:production:smoke`
- `npm run mentions:supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP when Supabase CLI is available
