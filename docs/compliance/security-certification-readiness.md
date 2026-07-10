# Security Certification Readiness

## Readiness statement

Picom is **not SOC 2 examined and not ISO/IEC 27001 certified**. The repository contains useful technical foundations and operational plans, but documentation or passing builds do not prove controls operate consistently over time. No certification, attestation, audit opinion, compliance logo, or “SOC 2/ISO compliant” claim may be made from this plan.

This is a gap assessment for the Windows, Linux, and macOS Electron service boundary using Supabase and LiveKit. It is not legal advice or an auditor's opinion.

## Framework orientation

### SOC 2 readiness

The AICPA describes SOC 2 as an examination of controls at a service organization relevant to the Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy. Picom should begin with Security (common criteria) and determine with an independent CPA/auditor whether Availability, Confidentiality, Processing Integrity, and Privacy are in scope.

Readiness requires a defined system description, control objectives/criteria mapping, management ownership, evidence, exceptions, complementary user/subservice controls, and an agreed Type I/Type II path. A Type II period requires proof that controls operated throughout the observation period, not a point-in-time repository snapshot.

Official reference: [AICPA System and Organization Controls suite](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services).

### ISO/IEC 27001 readiness

ISO/IEC 27001:2022 specifies requirements for an information security management system (ISMS): establish, implement, maintain, and continually improve a risk-based organizational system protecting confidentiality, integrity, and availability. Picom must define scope/context, leadership, policy, risk assessment/treatment, resources/competence, operations, performance evaluation, internal audit, management review, corrective action, and a justified Statement of Applicability.

Use the licensed current standard and qualified implementer/certification body for clause/control interpretation. The repository must not reproduce copyrighted standard text as an internal checklist.

Official references: [ISO/IEC 27001:2022](https://www.iso.org/standard/27001), [ISO/IEC 27001:2022/Amd 1:2024](https://www.iso.org/standard/88435.html).

## Proposed audit/ISMS scope

Initial scope candidate:

- Picom desktop applications and release/packaging pipeline for Windows, Linux, and macOS;
- Supabase Auth, Postgres, RLS, Storage, Realtime, and Edge Functions used by Picom;
- LiveKit voice/screen-share token and media service integration;
- source control, CI/CD, artifact/signing/update infrastructure, secrets, and developer/operations access;
- production/staging cloud accounts, DNS, support, monitoring, backups, exports, and incident response;
- personnel, contractors, vendors, policies, and facilities/processes that can affect the service.

Explicitly document exclusions and interfaces. Consumer devices, user-managed networks, and customer community administration may be complementary responsibilities, but Picom remains responsible for secure product/provider boundaries.

## Current strengths

Repository evidence currently includes:

- Electron isolation/minimal preload/CSP/external-link/deep-link security plans;
- Supabase RLS migrations/tests for core community, private channel, message, attachment, Storage, search, and realtime boundaries;
- secrets management/scanning and dependency vulnerability/update policies;
- incident response, rollback, postmortem, SLO, deployment, staging, restore, and backup verification runbooks;
- redacted logging/diagnostics/crash-reporting abstractions;
- append-only audit, abuse/security event, admin operations, retention/deletion, export, and data-residency plans;
- platform packaging, signing/notarization/distribution, provenance/checksum, rollout, and Go/No-Go documentation;
- typed build, mock smoke, structural Supabase smoke, and release quality gates.

These are implementation inputs, not operating-effectiveness evidence.

## Readiness gap summary

| Area | Current state | Readiness | Required next evidence |
| --- | --- | --- | --- |
| Governance/ownership | Owner placeholders in docs; no approved security governance charter | Not ready | Executive sponsor, security owner, policy approvals, RACI, risk acceptance authority |
| Scope/system description | Architecture/runbooks exist; no auditor-approved boundary/data-flow inventory | Partial | Current system description, assets/data flows, locations, subservice model, exclusions |
| Risk management | Risks documented per task; no single maintained risk register/method | Not ready | Methodology, likelihood/impact, owners, treatment, residual acceptance, periodic review |
| Policies | Many plans/placeholders; not approved/versioned as organizational policy | Partial | Approved policy set, review cadence, exceptions, acknowledgements, retention |
| Access control | Product RLS/preload foundations; workforce/cloud/CI access evidence absent | Partial | IAM inventory, least privilege, MFA, joiner/mover/leaver, quarterly reviews, break-glass logs |
| Audit logging | Community/audit/security foundations; production immutability/SIEM incomplete | Partial | Central append-only logs, time sync, access, retention, alerting, export and integrity tests |
| Change management | Task checkpoints/commits/quality gates; no formal approval/evidence period | Partial | Ticket-to-change trace, review/segregation, CI evidence, emergency change/reconciliation |
| Incident response | Runbooks/tabletops documented | Partial | Named/on-call roles, contact tree, completed exercises, lessons/actions, notification decisions |
| Vendors | Supabase/LiveKit identified; due diligence/contracts/subprocessor inventory unresolved | Not ready | Vendor register, risk tier, DPA/SLA/SOC reports, region, access, incident/exit reviews |
| Backups/continuity | Backup/restore plans; live automated restore evidence absent | Not ready | Approved RPO/RTO, encrypted backups, access/alerts, periodic restore results, continuity exercise |
| Monitoring | SLO/observability dashboards and placeholders; no production provider/evidence | Not ready | Metrics/log source inventory, alerts/on-call, response evidence, capacity and clock health |
| Vulnerability management | Dependency/security test plans; no continuous authenticated production program | Partial | Scans, triage SLAs, remediation evidence, penetration test, exceptions, runtime/host coverage |
| Data protection/privacy | Legal/privacy/retention/residency drafts | Not ready | Approved data inventory/classification, lawful basis/notice, DPA, rights/retention proof |
| Secure development | TypeScript/tests/reviews/checkpoints; developer training/process evidence absent | Partial | SDLC policy, threat models, review evidence, training, environment separation, test data policy |
| Physical/people controls | Outside repository | Not ready | HR screening/agreements, training, offboarding, device/office controls as scoped |
| Certification audit | No readiness assessment or auditor engaged | Not ready | Framework scope, gap remediation, evidence period, internal audit/management review, external audit |

## Control evidence model

Create a restricted control register, separate from public docs:

| Field | Purpose |
| --- | --- |
| Control ID/title | Stable reference |
| Framework mapping | Licensed SOC/ISO criterion/control mapping |
| Risk/objective | Why control exists |
| Owner/operator/reviewer | Accountability and separation |
| Frequency/trigger | Continuous, per change, monthly, quarterly, annual |
| Procedure | Repeatable operation |
| Systems/population | Complete evidence universe |
| Evidence source/retention | Tamper-resistant artifact and period |
| Exceptions | Detection, owner, due date, risk acceptance |
| Test method/result | Design and operating effectiveness |
| Last/next review | Currency |

Evidence must be reproducible, timestamped, attributable, scoped, retained, and protected. Screenshots alone are weak when logs/API exports can prove the full population.

## Audit logs

Required state:

- central inventory for product, auth, RLS/admin, cloud console, database, Storage, Realtime, LiveKit, CI/CD, source control, secrets, signing, update/release, support, and security events;
- append-only/immutable or compensating correction model;
- authenticated actor/service, timestamp, action, target, outcome, request/change ID, safe region/version metadata;
- no passwords, tokens, auth headers, assertions, private keys, raw message content, or unnecessary personal data;
- restricted viewing/export, retention approval, time synchronization, integrity/availability monitoring;
- alerts and incident linkage for privilege, credential, data-access, RLS denial, release/signing, backup, and audit-policy changes;
- evidence that normal users/operators cannot update/delete audit rows.

Current product audit foundations are partial; production centralization and live immutability/RLS tests are blockers.

## Access control

- Inventory workforce, contractor, service, CI, cloud, database, Supabase, LiveKit, DNS, repository, signing, and support identities.
- Enforce unique identities, MFA, least privilege, approved roles, separation of duties, short-lived access, secrets rotation, and monitored break-glass.
- Formal joiner/mover/leaver process with timely revocation and evidence.
- Periodic access review by system/data owner, including stale/service accounts.
- Production access is approved, time-bounded where possible, and logged; developers do not use shared credentials.
- Product authorization remains backend/RLS enforced and receives cross-tenant regression tests.

Open gap: organization/admin workforce controls and access review evidence are not implemented in repository code.

## Incident response

Existing runbooks and tabletop scenarios need operationalization:

- named incident commander, security/privacy/legal/operations/support contacts and on-call coverage;
- severity and notification/authority/customer decision matrix;
- evidence preservation/chain-of-custody and restricted communications;
- at least annual and material-change exercises, including private-data leak, bad desktop update, Supabase/LiveKit outage, credential compromise, and restore;
- after-action items tracked to closure and control/risk updates;
- vendor incident escalation and contractual timelines.

## Vendor management

Maintain vendor/subprocessor register with service/data/access, owner, risk tier, entity/region, contract/DPA/SLA, assurance reports/certificates, security questionnaire, breach notification, continuity, subprocessor changes, retention/deletion, audit rights, and exit/portability plan.

Minimum in-scope review includes Supabase, LiveKit, source control/CI, artifact distribution/signing/notarization, DNS/email, monitoring/crash/support providers, and any contractor with access. Provider certification does not certify Picom.

## Change management

- Approved ticket/requirement linked to commit, peer review, automated tests, security/privacy review where applicable, artifact provenance, release approval, rollout and rollback.
- Protected branches/CI and least-privileged production deploy identity.
- Database migrations/backups/compatibility reviewed before deployment.
- Emergency changes require authorization, logging, testing proportionate to urgency, and retrospective review.
- Failed tests/known vulnerabilities/exceptions cannot be silently overridden; risk acceptance is named and expires.
- Periodically reconcile deployed versions/configuration against approved source and artifact hashes.

Current task checkpoints and commits help traceability but do not prove independent review or protected CI.

## Backups and continuity

- Approve data/system inventory, RPO/RTO, retention, region, encryption, access, alerts, and legal hold/deletion behavior.
- Back up database and Storage objects/configuration separately; provider database backup does not automatically restore object bytes.
- Keep backup credentials separate and test restore to isolated staging on a schedule.
- Validate Auth, communities, channels, recent messages, roles/RLS, attachments objects/metadata, audit logs, functions/config, and desktop compatibility.
- Exercise provider outage, regional outage, corrupted release, key loss, and staff unavailability.
- Record actual recovery time/data loss and remediate missed objectives.

Current backup scripts/runbooks are guarded placeholders; live automated backup/restore evidence is missing.

## Monitoring and availability

- Define production SLO/SLI owners for API, Auth, message send, realtime, uploads, database, Storage, LiveKit, crash-free desktop sessions, and notifications where in scope.
- Deploy authenticated health/ready/live, logs, metrics, traces where appropriate, and version/platform/release dashboards.
- Alert thresholds have runbook, owner, escalation, maintenance suppression, testing, and response evidence.
- Monitor RLS/security denials, privilege/session changes, secret/signing use, backup failures, dependency vulnerabilities, config drift, rate abuse, and audit pipeline health.
- Capacity/availability and vendor status are reviewed; optional service degradation is explicit.
- Monitoring data is minimized/redacted, region/retention controlled, and protected from tampering.

Current dashboard/service abstractions are not a connected production monitoring system.

## Readiness program phases

### Phase 0: ownership and scope

- Engage qualified SOC/ISO readiness advisors/auditor/certification body.
- Name sponsor, ISMS/security owner, control owners, and internal audit independence.
- Approve scope, systems, locations, products, providers, criteria and target report/certification.

### Phase 1: inventory and risk

- Complete assets, data flows/classification, vendors, identities/access, legal/contractual requirements, and risk register.
- Approve risk methodology, treatment plan, policy set, Statement of Applicability approach, and exceptions.

### Phase 2: implement controls

- Close critical technical gaps: production RLS/realtime/Storage proof, audit centralization, secrets/IAM, monitoring, backup restore, vulnerability/patching, signed releases.
- Operationalize people/vendor/change/incident/privacy controls.

### Phase 3: evidence and internal assurance

- Run controls over a representative period.
- Collect population-complete evidence, test exceptions, run tabletop/restore/access review.
- Perform internal audit, corrective actions, and management review.

### Phase 4: external examination/certification

- Independent readiness review and remediation.
- Auditor determines SOC 2 Type I/II approach; accredited certification body determines ISO certification process.
- Control owners respond to samples/exceptions without fabricating evidence.

### Phase 5: continuous operation

- Track exceptions, corrective actions, risks, vendor/change/access reviews, incidents, objectives, internal audits, management reviews, surveillance/renewal, and product/provider scope changes.

## Immediate blockers

1. No approved security governance, ISMS scope, control owners, or central risk register.
2. No evidence period or independent audit/readiness engagement.
3. Production infrastructure/regions/providers and system description are not finalized.
4. Live Supabase RLS/Storage/Realtime multi-user testing remains blocked without CLI/staging evidence.
5. Production audit logging/monitoring/alerting/immutable evidence is incomplete.
6. Workforce/cloud/CI/signing access controls and periodic review evidence are absent.
7. Vendor due diligence, contracts, subprocessors, data residency, and exit plans are unresolved.
8. Automated backup plus successful restore evidence and approved RPO/RTO are absent.
9. Legal/privacy policies, retention, rights, and incident notification processes remain drafts.
10. Platform signing/notarization/update and production release operation is not fully proven.

## Claim and document control

- Use “preparing for” or “readiness planning” only.
- Do not use SOC/ISO logos or imply AICPA/ISO endorsement.
- Do not share restricted reports/evidence outside approved recipients.
- Verify current standards, criteria, amendments, and auditor guidance before starting the formal program.
- Version this plan and record approvals/changes; it is not the Statement of Applicability or SOC system description.

