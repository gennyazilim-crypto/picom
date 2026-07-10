# Picom Privacy Notice - Legal Review Draft

> **Draft for qualified privacy counsel and product review. Not legal advice, not an approved privacy notice, and not a claim of regulatory compliance.** Controller/operator identity, contacts, lawful bases, regions, retention periods, subprocessors, and effective date remain unresolved.

## 1. Product and data flow

Picom is a Windows, Linux, and macOS community chat desktop app. Supabase is planned for authentication, PostgreSQL data, storage, realtime, and Edge Functions. LiveKit is planned for voice and screen-share transport. Electron exposes restricted native capabilities through a preload bridge. Final provider names, entities, regions, and contract roles must be verified before publication.

## 2. Data categories

Picom may process:

- Account and authentication data: user ID, email, username, authentication provider metadata, session/security events. Password handling is delegated to the configured auth provider; Picom application logs and exports must not contain passwords or tokens.
- Profile and social data: display name, avatar, bio, status, follows, blocks, and privacy preferences.
- Community data: memberships, roles, permissions, channels, invites, reports, moderation actions, and audit records.
- User content: messages, reactions, replies, attachments, saved-message references, and content submitted to reports where permitted.
- Live communication metadata: room/channel identifiers, participant state, mute/deafen/speaking status, connection quality, and screen-share state. Media is transported for the live session; Picom does not claim production end-to-end encryption.
- Device and operational data: desktop platform/version, release channel, redacted diagnostics, crash context, request IDs, network state, abuse/security events, and coarse service health.

## 3. Purposes and legal bases

Expected purposes include providing requested features, authenticating users, enforcing permissions, preventing abuse, supporting users, securing systems, complying with law, and improving reliability. Qualified counsel must map each purpose to lawful bases by region, including contract necessity, legitimate interests balancing, consent, and legal obligations. Optional diagnostics/analytics must remain separately disclosed and controlled.

## 4. Visibility and recipients

Profile and content visibility depends on community, channel, relationship, block, and privacy settings. Community owners and authorized moderators may access limited content needed for moderation. Service providers process data only for contracted operations. Picom must not describe a channel as private if provider, moderator, security, legal, or backup access can still occur under defined controls.

No sale or targeted-advertising claim should be made until business practices and regional statutory definitions are reviewed.

## 5. Voice and screen sharing

Voice and screen sharing can expose spoken, visual, device, and network information. Users control when they join or share and should avoid exposing unrelated windows or secrets. Recording is not part of the current scope. Final notices must cover media routing, diagnostics, permissions, retention, and regional consent rules.

## 6. Storage, security, and retention

Picom uses access controls, row-level security, restricted desktop IPC, redacted logging, upload validation, and session controls as defense-in-depth measures. No system is guaranteed secure. Final retention schedules must cover active data, deleted content, attachments, reports, security/audit logs, backups, exports, and legal holds.

User export is a bounded authenticated JSON workflow. Account deletion revokes sessions, enforces ownership transfer, starts a 14-day review period, and requires controlled anonymization. Backup erasure, legal holds, audit integrity, and final Auth identity deletion require documented operator procedures.

## 7. User choices and rights

Product controls include profile/privacy settings, blocking, notification preferences, data export, and account deletion requests. Applicable rights may include access, correction, deletion, restriction, objection, portability, consent withdrawal, and complaint to a regulator. Identity verification, authorized agents, deadlines, exceptions, and appeal routes require region-specific counsel.

## 8. International transfers

Data may be processed where Picom and its providers operate. The final notice must identify primary regions, transfer mechanisms, supplementary measures, data residency limits, and how users obtain relevant safeguards. Launch must not rely on this draft as transfer authorization.

## 9. Children and sensitive data

Picom is not designed to solicit special-category/sensitive data. Users may nevertheless submit such content, so minimization and moderation guidance are required. Minimum age, parental consent, child-safety reporting, and age-assurance decisions must be made for every launch region before public availability.

## 10. Automated decisions and moderation

Spam, abuse, upload, and moderation signals may assist human review. The current product must not claim fully automated legal or similarly significant decisions. Final policy must describe material automated systems, human review, contest/appeal paths, and retention where required.

## 11. Changes and contact

Add the controller/operator name, privacy officer or contact, postal address, representative/DPO where required, complaint channel, version, effective date, material-change notice process, and archived policy versions before publication.
