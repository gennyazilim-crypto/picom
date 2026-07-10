# Task 286 - Legal acceptance tracking

## Status

Implemented for registration, mock mode, Supabase mode and policy re-acceptance.

## Delivered

- Registration requires an explicit Terms of Service and Privacy Policy checkbox and sends the current versions as auth metadata.
- Mock acceptance stores terms version, privacy version, timestamp and registration/reaccept source locally; missing evidence no longer receives a legacy bypass.
- Supabase profiles store accepted versions/timestamps and append acceptance evidence through protected trigger/RPC paths.
- Settings > Legal and About expose the beta draft documents and clearly state that professional legal review is still required.

## Privacy and security

Acceptance evidence contains version, timestamp, source and user identifier only. It does not store passwords, tokens, message content or raw network identifiers.

## Supabase verification

Apply `20260710090000_terms_acceptance_versioning.sql` and test registration plus re-acceptance against staging. Supabase CLI is unavailable locally, so hosted trigger/RPC execution is not claimed as passed.
