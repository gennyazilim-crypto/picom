# Task 183: Forum channels production

## Completed

- Added RLS-backed forum list and bounded visible search.
- Added validated desktop post creation.
- Linked each post atomically to a root message and standard thread.
- Reused ThreadPanel for permission-checked replies.
- Documented production limits and no-mobile boundary.

## Verification

- `npm run forum:channel:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
