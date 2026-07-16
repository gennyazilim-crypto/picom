# Sub-processor Register (T92 — Third-party Processor Governance)

Register of third parties that process Picom personal data, for GDPR/KVKK Art. 28 compliance.
Review quarterly; update on any add/remove and notify per the DPA. Linked to Consent/Compliance
(Intelligence platform Tasks 48/49).

| Sub-processor | Purpose | Data categories | Region | DPA |
|---|---|---|---|---|
| Supabase (AWS eu-central-1) | Database, auth, storage, edge functions | Account, profile, messages metadata, analytics (pseudonymized), security events | EU (Frankfurt) | Supabase DPA |
| LiveKit | Realtime voice/video transport | Voice/video streams, room membership metadata | Configure EU region | LiveKit DPA |
| Email/SMTP provider | Transactional email (verification, password reset) | Email address, name | Confirm EU region | Provider DPA |
| Steam (Valve) OAuth | Social sign-in (OpenID) | Steam ID, display name | US | Valve terms |
| Epic Games OAuth | Social sign-in (OAuth2) | Epic account id, display name | US | Epic terms |

## Governance rules
- No new sub-processor is added without: a signed DPA, a purpose entry above, and a data-category
  + region assessment.
- Cross-border transfers (US OAuth providers) are limited to the identifiers strictly needed for
  sign-in; no message content or behavioral analytics is shared with them.
- Special-category data is never collected, so none is shared with any sub-processor.
- On sub-processor change, follow the DPA notice period and update this file + the DPIA (Task 49).

## Open items (operator)
- Confirm and pin the email/SMTP provider region to EU; record the DPA link.
- Confirm LiveKit project region alignment with EU residency (Task 93).
