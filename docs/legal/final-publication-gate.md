# Terms, Privacy and Community Guidelines publication gate

## Decision

Final publication is **blocked**. Legal counsel review marker is PENDING, current documents are beta drafts, and `legalConfig.requiresProfessionalReview` remains true. Do not rename drafts, change `beta-*` versions to final, or present acceptance as regulatory compliance.

## Approved publication bundle

Counsel/Product/Privacy/Security must approve exact immutable files for Terms, Privacy, Community Guidelines and Acceptable Use. Each bundle records document ID, semantic/date-based version, title, locale, effective/published time, content SHA-256, approvers/evidence reference, superseded version and whether reacceptance is required. Archive every served version; never mutate text under an accepted version/hash.

Public locations and controller/contact URLs must be approved HTTPS origins. The installed desktop app keeps a local readable copy or safe bundled view for the accepted version and external links use `externalLinkService` only. No private host, token or admin draft appears in client config.

## Product acceptance flow

- Registration shows unchecked explicit acceptance with direct Terms and Privacy links; no prechecked/dark-pattern consent.
- Record authenticated user, exact Terms/Privacy versions and trusted server timestamp through the protected backend path; do not trust a client-only timestamp for production evidence.
- Settings/About/Legal exposes current documents, version/effective date, privacy/contact links and policy-change status.
- Material change uses notice plus reacceptance gate decided by counsel; safety/security emergency changes follow incident/legal review.
- Acceptance failure has a clear retry/sign-out path and does not silently mark accepted.
- Community Guidelines/AUP acknowledgement is separately tracked only if counsel/product requires it; do not overload privacy consent.

## Publication sequence

1. Close GDPR/DSA tracker and reconcile text with deployed export/deletion/report/appeal/retention/provider behavior.
2. Approve identity, license, locales, contacts, age/regions, processors/transfers and effective date.
3. Freeze files, compute hashes and create version registry/migration; peer-review no secrets/private comments.
4. Test registration links/checkbox, server acceptance, existing-user reacceptance, offline/error/accessibility and Settings/About links in staging.
5. Publish immutable public copies and bundled copies atomically; verify hashes/content/URLs.
6. Roll out internal/beta, monitor auth/legal errors and support; obtain final go/no-go before stable.

## Correction and rollback

Never silently edit an accepted policy. Typographical/legal correction creates a new version and counsel decides notice/reacceptance. If publication is wrong, stop new acceptance, preserve audit/old copies, notify Legal/Security/Product, publish corrected version and migration. Database acceptance history remains append-only and excludes passwords/tokens/content.

## Current blockers

- counsel/controller/contact/jurisdiction/age/processor/transfer/retention decisions pending;
- final text/locales/accessibility and effective date unapproved;
- production workflow reconciliation and live server acceptance/RLS evidence incomplete;
- no immutable public policy host/version registry/hashes approved.

Until all gates pass, current beta draft UX may support controlled testing only.
