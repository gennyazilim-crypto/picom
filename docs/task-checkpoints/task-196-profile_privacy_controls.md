# Task 196 Checkpoint: Profile Privacy Controls

- Added independent location, timezone, activity, and media visibility preferences.
- Added Everyone, Shared communities, and Friends audience controls in Settings > Privacy & Safety.
- Stored preferences in an owner-only table with RPC-only writes.
- Added viewer projections that enforce block, friendship, and shared-community context.
- Added channel-authorized activity projection so private activity is not exposed to visitors.
- Applied the same projection to mock/full ProfileView with a polished restricted state.

Validation: `npm run profile:privacy:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
