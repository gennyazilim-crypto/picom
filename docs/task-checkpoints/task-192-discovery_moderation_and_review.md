# Task 192 Checkpoint: Discovery Moderation and Review

- Preserved the app-admin-only approval queue and atomic audit event.
- Added allowlisted discovery content flags to the safe queue projection.
- Required a reviewed category before approval.
- Added automatic re-review when material public profile fields change.
- Added content-free report submission rate limiting at five reports per user per hour.
- Confirmed reports only contribute aggregate counts; descriptions, reporter identities, messages, attachments, and member data remain excluded.
- Confirmed no listing appears publicly without an explicit `approved` review row.

Validation: `npm run discovery:moderation:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
