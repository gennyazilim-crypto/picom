# Task 261 checkpoint: advanced permission model review

- Reviewed Owner/Admin/Moderator/Member/Visitor hierarchy across shared types, renderer helpers and SQL/RLS behavior.
- Identified release-critical drift: duplicated key registries, fixed renderer role grants, message-send parity and private-channel parity gaps.
- Defined a canonical permission registry, effective-access order, bot/webhook service-principal rules and channel-override constraints.
- Added a six-phase migration plan plus RLS impact, parity tests and rollback requirements.
- Made no schema, RLS, code, UI, dependency or runtime change; implementation remains blocked on explicit approval and hosted tests.

Validation: a local documentation contract check verified role hierarchy, channel overrides, private-channel access, bot/webhook permissions, basic-model migration and RLS impact. Typecheck, mock smoke and build were skipped because this task is documentation-only.
