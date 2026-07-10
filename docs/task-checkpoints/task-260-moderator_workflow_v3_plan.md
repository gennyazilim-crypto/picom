# Task 260 checkpoint: moderator workflow v3 plan

- Unified report queue, bounded evidence links, action confirmation, timeouts, appeals and immutable moderation history into a v3 workflow plan.
- Defined explicit owner/admin/moderator/member permissions, hierarchy checks and private-channel evidence boundaries.
- Kept report `action_taken`, actual moderation transactions and appeal reversal as distinct failure-safe operations.
- Added required reasons, idempotency/conflict handling, privacy exclusions, staging tests and rollout gates.
- No moderation capability, UI, schema, dependency or runtime behavior was implemented.

Validation: a local documentation contract check verified report queue, appeals, timeouts, audit log, action reasons, evidence links, permissions and privacy boundaries. Typecheck, mock smoke and build were skipped because this task is documentation-only.
