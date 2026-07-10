# GDPR and DSA legal review follow-up

> Engineering issue tracker, not legal advice or a compliance claim. Qualified counsel must determine Picom's controller/processor roles, jurisdiction, DSA service classification and exact obligations before public launch.

Official orientation references: [European Commission data subject rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en), [information to provide when collecting data](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/what-information-must-be-given-individuals-whose-data-collected_en), and the [EU data-protection legal framework](https://commission.europa.eu/law/law-topic/data-protection/legal-framework-eu-data-protection_en). Counsel must confirm current authoritative law/guidance and applicability.

## Required counsel decisions

### Identity, scope and lawful processing

- legal controller/publisher/contact/DPO or representative where applicable;
- target countries, age/parental-consent policy, business/user eligibility and geo restrictions;
- per-purpose data inventory/legal basis for account/profile, communities/messages/attachments, moderation/report/appeal, audit/security/abuse, presence/realtime, voice signaling, diagnostics/support and optional analytics;
- necessity/minimization, special-category/children risk, automated decision/profiling and DPIA/legitimate-interest assessment needs.

### Transparency, vendors and transfers

- final Privacy/Terms/Guidelines versions, effective date/change notice/reacceptance;
- recipients/processors/subprocessors, Supabase/LiveKit/email/support/monitoring/signing/hosting regions, DPAs and transfer mechanism/assessment;
- retention by live database, deleted state, audit/security logs, backups, object storage, provider copies and legal preservation;
- security measures stated accurately without claiming E2EE, absolute confidentiality, certification or guaranteed deletion outside actual behavior.

### Rights and account workflows

- authenticated intake/identity verification and deadlines for access, correction, deletion, restriction, objection, portability and complaint/escalation;
- export scope/format/redaction, third-party/private-channel rights, denied/partial response and appeal;
- deletion consequences for owned communities, audit integrity, anonymization, backups, legal claims/holds and session revocation;
- request log/retention and safe communication without passwords/tokens.

### Platform safety/DSA assessment

Counsel must classify Picom and decide which DSA duties apply. Review easy notice/report access, actionable reason categories, acknowledgement/status, trusted flagger/out-of-court/contact/representative duties if applicable, statement-of-reasons/transparency reporting, internal complaint/appeal, repeat misuse, illegal-content handling, moderation terms, recommender/advertising/minor protections and law-enforcement requests. Do not implement or publish obligations based only on this checklist.

Community moderators and Picom app operators have distinct authority. Notices, appeals and enforcement must be permission-scoped, auditable, privacy-minimized and protect reporters/targets from unnecessary disclosure. Emergency safety/law requests require approved escalation, preservation and disclosure controls.

## Product-to-policy reconciliation

| Workflow | Engineering evidence | Counsel decision required |
| --- | --- | --- |
| Report/block/moderation | reports, appeals, Trust & Safety foundations | notice, reasons, status, confidentiality, deadlines, abuse, escalation |
| Appeal | community-scoped reviewer workflow | eligibility, independence, outcome notice, retention and external remedies |
| Data export | authenticated bounded export foundation | scope, portability format, third-party redaction, denial/exemption |
| Account deletion | confirmation/session revoke/anonymization plan | retention exceptions, backups, owned communities and notice |
| Guidelines enforcement | draft guidelines and moderation permissions | prohibited content, jurisdictional process, proportionality and changes |

## Launch blockers and marker

- [ ] Counsel name/firm and scope approved outside repository.
- [ ] Controller/contact/regions/vendors/transfers/retention/age decisions complete.
- [ ] Final Terms, Privacy, Community Guidelines and Acceptable Use text approved.
- [ ] Report/notice/action/appeal and data-rights workflows match deployed behavior and SLAs.
- [ ] DPIA/representative/DPO/transparency/reporting decisions documented where applicable.
- [ ] Policy versioning, registration/reacceptance and accessible publication tested.
- [ ] Legal/Product/Privacy/Security sign-off evidence recorded.

**Legal counsel review marker: PENDING. Public stable release and any compliance claim remain blocked.**
