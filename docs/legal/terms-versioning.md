# Terms and privacy acceptance versioning

## Status

Picom records acceptance of the current Terms of Service and Privacy Notice bundle. The current beta review version is `beta-2026-07-10.1`. The policy text remains a legal-review draft; versioning is acceptance evidence, not legal approval or compliance certification.

## Registration

- Registration UI requires an unchecked explicit acceptance checkbox.
- `authService` rejects registration unless the submitted version equals the application current version.
- Supabase signup metadata carries only terms/privacy version identifiers, never a password or token.
- An Auth trigger compares metadata against `legal_policy_versions`, uses the server timestamp, updates protected profile fields, and appends an acceptance event.
- Direct profile updates cannot modify legal acceptance fields; a database trigger protects them.

## Re-acceptance

On authenticated startup, Picom compares `profiles.accepted_terms_version` and `accepted_privacy_version` with the current application version. A mismatch opens a blocking desktop review view with Terms, Privacy, Accept, and Sign out actions. The authenticated `accept_current_legal_terms()` RPC reads the authoritative database versions, records a server timestamp, and appends an immutable event.

Product/legal owners must update the app constant and `legal_policy_versions` migration together. Whether a non-material privacy wording change requires renewed acceptance is a qualified legal decision; do not silently change a version already published.

## Mock development behavior

Existing local seed accounts without an acceptance record are treated as legacy-development accepted so normal mock startup is not unexpectedly blocked. New mock registrations store the current version locally. A stored stale mock version triggers re-acceptance, enabling deterministic QA without contacting Supabase.

## Data and privacy

Stored evidence is limited to user ID, terms version, privacy version, server timestamp, and source (`registration` or `reaccept`). Do not store IP addresses, device fingerprints, passwords, auth tokens, content, or full policy text in acceptance events. Published policy text and version archives must be retained separately.

## Release procedure

1. Obtain written approval for policy text, effective date, and re-accept decision.
2. Assign immutable terms/privacy version identifiers.
3. Archive rendered policy text and localization for those versions.
4. Update database version rows and application `legalConfig` in the same release train.
5. Verify new registration and existing-user re-acceptance in staging.
6. Verify direct profile writes cannot forge acceptance.
7. Verify users can review both documents and sign out instead of accepting.
8. Record rollout, support, and rollback behavior.

## Known limitations

- Current identifiers describe beta legal-review drafts and must not be presented as counsel-approved.
- Live migration/RLS/trigger verification requires Supabase CLI or staging.
- Locale-specific acceptance and separate terms/privacy version lifecycles need product/legal decisions before international launch.
