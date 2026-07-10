# Task 289 - Content reporting UX polish

## Status

Implemented for user, message, and community reports.

## Delivered

- Existing context-menu/community report entry points open one consistent desktop report modal.
- Clear reason categories, optional bounded description, character count and good-faith abuse warning.
- Submission remains visible as a `Report received` confirmation instead of closing immediately.
- Message report metadata uses safe author/channel labels and does not copy message body into the report request.
- Existing queue integration, description redaction, moderator-only queue access and target-visibility RLS remain authoritative.

## Privacy boundary

Reports store target identifiers, category and the reporter's optional redacted description. Moderators retrieve target context through their existing channel/community permissions; unrelated private content is not bundled into the report.

## Supabase verification

Hosted staging should test message/user/community target validation plus moderator queue access. Supabase CLI is unavailable locally, so hosted RLS execution is not claimed as passed.
