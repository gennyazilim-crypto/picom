# Community domain types

Task 061 formalizes the TypeScript domain types used by the MVP mock community state.

## Included types

- Community, category, channel, member, role, message, attachment, and reaction models.
- ID aliases for community/channel/member/message/user/role/attachment references.
- User status, channel type, attachment type, and role name unions.
- Optional future-safe fields such as channel/category position, attachment dimensions, and local message status.

## Guardrails

- These are safe frontend DTO/domain types, not Supabase database entities.
- They do not include password hashes, tokens, sessions, or secrets.
- Required fields match the current mock data so the app remains stable.