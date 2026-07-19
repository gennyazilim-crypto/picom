# Secret Community Production Contract

## Security boundary

Secret communities use the canonical visibility value SECRET. They are never returned by discovery, global search, Mention Feed, unified Feed, recommendations, directories, or public profile activity. Community content remains available only inside the community workspace to active members through existing channel and message RLS.

## Creation eligibility

Creation is allowed only when the authenticated account has a unique phone verified through a Twilio Verify voice call, is not suspended, and has no active community-creation restriction. Picom stores an HMAC-SHA256 phone fingerprint, last four digits, and calling-code metadata; it never stores the raw phone number.

Required Edge Function secrets:

- TWILIO_API_KEY
- TWILIO_API_SECRET
- TWILIO_VERIFY_SERVICE_SID
- PHONE_VERIFICATION_HASH_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- PICOM_ALLOWED_ORIGINS

If the provider or secrets are unavailable, the feature fails closed and reports VOICE_VERIFICATION_NOT_CONFIGURED.

## Invitation contract

Secret invitations are generated only by Owner, Admin, Moderator, or roles with createInvites. Each invitation is bound to one user ID, expires exactly one hour after creation, has a database-enforced maximum of five uses, and is invalidated after the first successful acceptance or when the recipient leaves. Only a SHA-256 credential hash is stored. The raw credential is returned once to the authorized creator and cannot be recovered. Automatic notification-center, DM, and email delivery uses the invitation UUID, never the raw credential. The UUID is not sufficient by itself: preview and acceptance require an authenticated session matching the bound recipient, and the same expiry, status, warning, rules, and membership checks still run.

Acceptance is one atomic transaction: recipient match, expiry, use limit, phone and voice verification, account status, warning version, rules version, membership insert, audit record, invitation invalidation, and trust event.

## Root operations

Root Dashboard access is enforced by is_root_owner. Root can inspect operational metadata, safe invitation records, trust score, trust history, recommendations, and security events. Raw invitation credentials and raw phone numbers are never returned. Trust scores are invisible to community members.

## Realtime and audit

Secret invitation, trust, and security-event tables are added to Supabase Realtime when the publication exists. RLS limits direct rows to Root. Acceptance, usage, security, and trust-history records are immutable. Leaving immediately removes access through membership RLS and invalidates all historical invitations for that account.
