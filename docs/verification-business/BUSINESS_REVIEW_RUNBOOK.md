# PICOM Business Review Runbook

Audience: Root / Trust & Safety reviewers.

## Review checklist

1. Confirm applicant is an organization owner or business admin.
2. Compare legal name, brand name, registration country, and website.
3. Confirm representative email uses a corporate domain (not consumer mail).
4. Open submission snapshot — do not trust client-side form state.
5. Verify required documents exist for company type.
6. Confirm malware scan is not pending/infected before approval.
7. Domain verification: treat as supporting evidence only; never auto-approve from domain alone.
8. Check risk flags / duplicate registration or VAT signals; create review notes, do not auto-reject from flags alone.
9. Record public decision reason separately from internal notes.
10. Use idempotent Approve once; retries with same key must not double-grant.

## Required documents by company type (baseline)

| Type | Baseline docs |
|---|---|
| sole_trader | registration / tax certificate, proof of address, representative authorization |
| partnership | partnership registration, representative authorization |
| limited_company / corporation | company registration, trade registry extract, tax certificate |
| nonprofit / public_institution | formation / charter evidence, representative authorization |
| agency | registration + brand authorization if representing another brand |
| other | Root-defined set; request information before approve |

## Domain verification checklist

- Domain normalized; reject localhost / private / consumer domains
- Challenge not expired
- DNS/web fetch only when `BUSINESS_DOMAIN_VERIFICATION_ENABLED=true`
- If provider unavailable: leave pending; do **not** mark verified manually without evidence in audit notes

## Representative verification checklist

- PICOM account ownership
- Email ownership / corporate domain alignment
- Role on application matches organization membership
- Authorization letter when required
- Manual override must include reason code + reviewer id (Root RPC)

## Trademark impersonation checks

- Brand name vs official website / domain
- Known mark collisions → risk flag + request information
- Do not approve solely because documents parse as PDFs

## Request information flow

1. Transition to `requires_information`
2. Public reason describes what the applicant will see
3. Internal notes capture missing evidence
4. Applicant may edit allowlisted draft fields and resubmit → `submitted`

## Approval flow

1. Start review (`under_review`) when needed
2. Confirm malware gate
3. Confirm documents + representative confidence
4. `approve_business_application` with public/internal reasons + idempotency key
5. Confirm badge + `business_dashboard` entitlement exist for organization

## Rejection flow

- Internal notes required
- Public reason optional but preferred
- No badge grant; history retained

## Suspension / revocation

- Suspend: badge suspended, profile unpublished/suspended, entitlement reconciled
- Revoke: badge revoked, profile unpublished/archived policy, entitlement revoked
- Do not delete organization or user accounts as part of revoke

## Appeal / re-review

- Rejected → may return to `draft` for a new submission path when policy allows
- Suspended → restore via approve path after remediation
- Always append history; never edit prior history rows

## Incident escalation

Escalate to platform security when: malware infected documents, SSRF attempts on domain checks, credential stuffing on invitations, mass duplicate registration/VAT spam.

Contact roles:

- Verification / Business verification: `verify@picom.gg`
- Commercial / partnership: `info@picom.gg`

## Audit requirements

Every Root decision must land in application status history and admin audit surfaces. Internal notes must never be copied into notifications, public profile DTOs, or applicant DTOs.
