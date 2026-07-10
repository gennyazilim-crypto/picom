# Picom Policy Versioning

Status: **Architecture policy / professional legal review required**

This document defines product and engineering behavior for versioning Picom's Terms of Service, Privacy Notice, Community Guidelines, and Acceptable Use Policy. It is not legal advice and does not approve the current beta drafts for production use.

## Policy inventory

| Policy | Config key | Current beta version | Acceptance evidence |
| --- | --- | --- | --- |
| Terms of Service | `termsVersion` | `beta-2026-07-10.1` | Required |
| Privacy Notice | `privacyVersion` | `beta-2026-07-10.1` | Required acknowledgement |
| Community Guidelines | `guidelinesVersion` | `beta-2026-07-10.1` | Displayed; explicit acceptance decision pending legal review |
| Acceptable Use Policy | `acceptableUseVersion` | `beta-2026-07-10.1` | Displayed; explicit acceptance decision pending legal review |

The renderer's `legalConfig` is a display/build snapshot. In Supabase mode, `legal_policy_versions` is authoritative for Terms and Privacy re-consent. Future production work must extend the server table before Guidelines or Acceptable Use are made separately consent-bearing.

## Version format

The current beta format is `beta-YYYY-MM-DD.revision`. Before stable launch, legal and product owners should choose an immutable semantic policy version such as `1.0.0` and preserve every published document artifact.

- Major: materially changes user obligations, data processing, dispute terms, enforcement scope, or rights. Re-consent is required.
- Minor: adds a meaningful but compatible policy section. Legal review decides whether re-consent is required; default to required when uncertain.
- Patch: editorial clarification, typo, formatting, or contact-detail correction with no material effect. Re-consent is normally not required, but the published version and changelog still advance.

No policy version may be reused for different content.

## Re-consent flow

1. Legal/product owners approve the document, version, effective date, change summary, affected regions, and whether re-consent is required.
2. The backend publishes the authoritative version in `legal_policy_versions`; clients do not decide this from remote feature flags.
3. On authenticated startup, Picom compares the user's accepted Terms/Privacy versions with the authoritative versions.
4. A required mismatch blocks community content behind the desktop `TermsReacceptPrompt`; the user may review documents, accept, or sign out.
5. Acceptance is written through `accept_current_legal_terms()` using the server timestamp and appended to `legal_acceptance_events`.
6. A failed write does not unlock the app. The UI shows a recoverable error without logging tokens or document content.
7. Mock mode mirrors the version, timestamp, and registration/reaccept source in local storage only.

Re-consent must never be inferred from continued use, a pre-checked box, app update installation, or a feature flag.

## Publication workflow

1. Draft and legal review.
2. Security/privacy review for data-flow claims.
3. Product approval and localization review.
4. Assign a new immutable version and effective date.
5. Archive the exact rendered artifact and a human-readable change summary.
6. Stage migration/config updates and test registration, existing-user re-consent, offline failure, and sign-out.
7. Release server authority before or with compatible desktop clients.
8. Monitor acceptance-write failures without collecting sensitive content.

## Compatibility and rollback

- Clients below the supported legal-flow version must be blocked or updated before a mandatory re-consent rollout.
- Rolling back document content must publish a new version; never mutate accepted historical content in place.
- If a policy rollout is paused, keep recorded evidence append-only and publish a corrective version/notice after legal review.
- Policy acceptance cannot be disabled solely by frontend feature flags.

## Data minimization

Acceptance evidence contains user identifier, policy versions, server timestamp, and source. Do not add passwords, tokens, message content, authorization headers, raw device fingerprints, or raw IP addresses without a separately approved privacy/legal basis.

## Release gate

Production publication remains blocked until qualified legal counsel approves the final text, regional applicability, consent language, retention period, withdrawal/termination handling, and accessibility/localization requirements.
