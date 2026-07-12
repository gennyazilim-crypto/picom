# Picom V1 Legal Approval Gate

Status date: 2026-07-12
Decision: **BLOCKED / NO-GO**

This record is an engineering release gate, not legal advice or legal approval. Codex and engineering automation cannot approve a license, policy, jurisdiction, or launch. An authorized legal/product reviewer must approve the exact immutable V1 bundle.

## V1 legal inventory

| Item | Current evidence | V1 decision |
| --- | --- | --- |
| Root project/application `LICENSE` | All-rights-reserved placeholder; no final grant | BLOCKER |
| Terms of Service | `beta-*` legal-review draft | BLOCKER |
| Privacy Notice | `beta-*` legal-review draft, scoped to enabled V1 data paths | BLOCKER |
| Community Guidelines | `beta-*` moderation/legal-review draft | BLOCKER |
| Acceptable Use Policy | `beta-*` legal-review draft, scoped to enabled V1 features | BLOCKER |
| Diagnostics and log export | Redaction/user-control engineering contract exists; legal wording unapproved | BLOCKER |
| Account deletion and data export | Engineering flows exist; retention, backup and regional wording unapproved | BLOCKER |
| Voice/Screen Share consent and provider disclosure | Technical copy updated for Task 668; authorized legal approval missing | BLOCKED / NO-GO |
| Radio, Podcasts, Meetings and AI | Not part of V1 legal acceptance or public release claims | POST-V1 |

`src/data/legalDocuments.ts` remains visibly labeled `Legal Review Draft`. Its V1 copy truthfully describes LiveKit Voice/Screen transport and the no-default-recording boundary, while Radio, Podcast, Meeting, and AI remain excluded. The copy is not authorized legal approval.

## Surface integration audit

| Surface | Current state | Approval requirement |
| --- | --- | --- |
| Registration | Terms and Privacy open from the acceptance control; beta version is recorded | Replace only with approved immutable versions and server-trusted acceptance evidence |
| Settings/About | Bundled legal document viewer is available | Show approved version, effective date, controller/contact and immutable public links |
| Help | No approved final legal destination can be certified | Add approved support/privacy/legal destinations after publication |
| Installer | Draft index exists; no placeholder is presented as binding installer consent | Package approved license/notices and verify platform presentation |
| Website/download surface | No approved immutable public policy origin is frozen | Publish approved HTTPS copies and verify hashes/links |

The missing links are blockers, not permission to substitute placeholder URLs.

## Required authorized approval package

Approval must identify:

- named qualified reviewer and accountable product owner;
- exact file versions and SHA-256 hashes;
- project/application license grant;
- launch jurisdictions, age/eligibility rules and governing terms;
- operator/controller identity and privacy, support, copyright and safety contacts;
- effective/publication dates and re-consent rules;
- processors, regions, transfers, retention, deletion, export and backup treatment;
- diagnostics policy, moderation, reporting and appeal decisions;
- unresolved risks accepted or rejected and an explicit V1 Go/No-Go decision.

## Immutable publication rule

Approved text must be copied to versioned immutable artifacts. Never edit content under an accepted version/hash. Any correction creates a new version and an authorized reviewer decides notice and re-consent. Registration, Settings, installer and website must resolve to the same approved bundle before RB-10 can close.

## Current release decision

No authorized approval package was supplied. Root `LICENSE`, current beta policy versions and publication surfaces remain unchanged. RB-10 stays open and no V1 stable artifact may be distributed publicly.
