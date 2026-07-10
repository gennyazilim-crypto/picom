# External security review coordination

## Status

Planned, not commissioned or completed. No reviewer/vendor, contract, NDA, report, attestation or certification is claimed. Engagement requires Security, Legal/Privacy, Engineering and Product approval.

## Selection and independence

Select a reviewer with Electron desktop, Supabase/Postgres RLS, Realtime/Storage, WebRTC/LiveKit and cloud/API authorization experience; confirm conflicts, methodology, staffing, insurance/contract terms, data handling, region/subprocessors, secure evidence portal, retention/deletion and retest support. Reviewer must be independent of implementation ownership and disclose subcontractors/tooling.

## Contract/legal placeholder

Execute NDA/confidentiality, master/SOW, authorized scope/rules of engagement, data processing/security terms, breach notification, evidence ownership/retention/deletion, vulnerability disclosure/embargo, liability and emergency contacts. Legal approval decides what can be shared; the repository stores no signed agreement, personal contact or private report.

## Engagement package

- approved `docs/security/penetration-test-plan.md` and Task 229 final preparation/report template;
- exact staging hosts/project refs through restricted channel, test dates/IPs/rates/tools and stop authority;
- synthetic accounts/access matrix, build commit/artifact checksums, architecture/data flows and threat models;
- RLS migrations/tests, Electron IPC/preload/CSP/deep-link boundaries, Edge Function contracts, upload quarantine and LiveKit token model;
- known issues/exclusions, monitoring/on-call/backup reset and incident path.

No production credentials/data or broad provider console access. Prefer time-bound least-privilege test access with MFA, logging, expiry and revocation.

## Findings workflow

1. Reviewer reports through restricted channel; Security validates scope/severity without requesting unnecessary data.
2. Critical/High freezes affected release and opens incident when active exposure is plausible.
3. Assign owner, due date, root cause, minimal fix and regression test; no frontend-only authorization fix.
4. Review patch for sibling paths/systemic cause and preserve audit evidence.
5. Reviewer independently retests exact staging build; internal tests alone do not close Critical/High.
6. Record fixed/accepted/deferred/duplicate status and residual-risk approval. Expired exceptions reopen automatically.

Target placeholders: Critical immediate triage and fix before release; High triage within one business day and fix before release; Medium owned plan within 30 days; Low/Informational risk-based backlog. Contract/SLA approval supersedes placeholders but cannot waive active cross-tenant/credential/native-code risk casually.

## Coordinated public disclosure

Default report remains confidential until remediation/retest and affected-user/legal assessment. Public advisory decision is jointly owned by Security/Legal/Product and includes affected versions, impact, remediation/update guidance, credits if consented, CVE only when applicable, timeline and support channel. It excludes exploit detail that endangers unpatched users, private infrastructure, credentials, real user data and reviewer personal data.

Do not suppress good-faith reporting, retaliate, overstate certification, publish before affected users can be protected, or promise a bounty/safe harbor not legally approved. Security incident/regulatory/customer notification duties override marketing/embargo preferences.

## Completion gate

Signed scope/contract, review execution, report acceptance, Critical/High closure with independent retest, Medium plan, evidence deletion confirmation, disclosure decision and Security/Engineering/Product/Legal sign-off. Until then stable v2 remains blocked on external security review evidence.
