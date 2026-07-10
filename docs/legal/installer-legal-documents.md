# Picom Installer Legal Document Set

> **Legal review required.** This index is an engineering integration map, not
> approved legal text, legal advice, or a claim of compliance.

## Documents

- [Installer license notice](installer-license.md): records that the project
  license and installer terms are not yet chosen.
- [Terms of Service draft](terms.md): product/service terms requiring operator,
  regional, liability, and acceptance review.
- [Privacy Notice draft](privacy.md): expected desktop/backend data flows with
  unresolved controller, lawful basis, retention, transfer, and contact fields.
- [Community Guidelines draft](community-guidelines.md): trust-and-safety policy
  direction requiring enforcement and appeal approval.
- [Acceptable Use Policy draft](acceptable-use.md): prohibited-use direction
  requiring legal, security, and operations approval.
- `THIRD_PARTY_NOTICES.md`: mandatory attribution and dependency notice source,
  including Coolicons by Kryston Schwarze under CC BY 4.0.

## Packaging decision

None of the Picom legal drafts is configured as a mandatory installer acceptance
screen. Showing an unapproved placeholder as binding terms would create false
consent and must block release. After review, engineering must:

1. receive approved, versioned source text and effective dates;
2. verify operator/contact/region data;
3. decide whether installer acceptance is legally/product necessary;
4. preserve a non-editable release copy and acceptance evidence when required;
5. validate Windows, macOS, and Linux presentation and accessibility;
6. keep third-party notices available independently of product terms.

## Publication blockers

- Project/product license not selected.
- Legal operator identity and contact fields unresolved.
- Regional launch scope and governing terms unresolved.
- Privacy retention, processors, regions, and transfer mechanisms unresolved.
- Enforcement, appeal, and safety escalation policy not operationally approved.
- Final translated text and language precedence not reviewed.

Public distribution is No-Go until the applicable blockers are signed off by
qualified product/legal owners. Internal technical testing may continue with
these files clearly marked as drafts.
