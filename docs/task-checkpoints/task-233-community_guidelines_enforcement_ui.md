# Task 233 checkpoint: Community Guidelines enforcement UI

- Added Community Guidelines access to owner/admin, moderator, member and visitor community panels using the existing legal-review draft modal.
- Preserved report message/user/community entry points, permission-scoped moderator queue and affected-user appeal boundary.
- Added no new private-content list or final-policy claim.
- Validation: `npm run guidelines:enforcement:ui:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.
