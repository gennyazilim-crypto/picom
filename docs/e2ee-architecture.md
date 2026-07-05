# End-to-End Encryption Architecture Plan

Picom does **not** currently provide production end-to-end encryption. This document is a future architecture plan for direct messages or selected private channels after the core Electron, Supabase, LiveKit, and moderation foundations are stable.

## Goals

- Explore privacy-preserving encryption for future direct messages or private-channel conversations.
- Keep encryption decisions explicit before changing the current message system.
- Preserve Windows, Linux, and macOS desktop usability.
- Avoid unsafe custom cryptography and avoid claiming encryption before implementation and audit.
- Define how E2EE would coexist with Supabase Auth, Supabase Realtime, Supabase Storage, and LiveKit.

## Non-goals

- No cryptography is implemented in this task.
- No current messages are encrypted by this document.
- No production E2EE claim should appear in UI, README, release notes, or marketing until it is implemented, audited, and tested.
- No arbitrary plugin/bot access to plaintext is allowed.
- No mobile key-management design is included because mobile is out of current scope.

## What could be encrypted later

- Direct message body text.
- Private-channel message body text for communities that explicitly enable E2EE.
- Attachment file bytes before upload to object storage.
- Attachment thumbnail bytes if private previews are supported.
- Local drafts if a secure local keystore strategy is approved.

## Metadata that would remain visible

Even with E2EE, some metadata is normally visible to the backend or transport systems:

- User IDs and community/channel IDs.
- Message IDs, timestamps, edit/delete markers, and approximate sizes.
- Sender/recipient membership relationships.
- Realtime room membership and connection timing.
- Attachment metadata such as encrypted object size and content type category.
- Abuse, rate-limit, audit, and delivery metadata.

## Key management placeholder

A future design should use well-reviewed primitives and libraries rather than hand-rolled cryptography. A conservative direction:

- Generate per-user device identity keys on trusted desktop clients.
- Store private keys using OS-protected storage when available.
- Use per-conversation symmetric keys wrapped for each authorized device.
- Rotate conversation keys when membership changes.
- Keep key recovery optional and explicit because recovery can weaken E2EE.
- Never upload raw private keys to Supabase.

## Device trust model

- Each desktop installation should be treated as a separate device.
- New devices require verification before receiving conversation keys.
- Revoked sessions should stop receiving new keys.
- Lost devices require key revocation and possibly conversation re-keying.
- A future account activity view should show trusted devices and key status.

## Multi-device issues

- Historical messages may be unavailable on a new device until another trusted device shares keys.
- Offline devices can miss key rotations and need a recovery/rejoin path.
- Multi-window sessions on one desktop should share the same secure local key material carefully.
- Backup and restore must not silently export raw keys.

## Search limitations

Encrypted message content cannot be searched by the server. Options later:

- Local-only search on decrypted messages already present on the device.
- Private searchable indexes encrypted per device, after security review.
- Clear UI copy explaining that server-side search is limited for encrypted spaces.

## Moderation limitations

E2EE limits server-side content moderation. Picom must decide where encryption is appropriate:

- Public/community-wide channels may remain server-visible for moderation.
- Private E2EE channels may require client-side reporting with user-selected evidence.
- Report flows must let users intentionally include decrypted snippets or screenshots.
- Audit logs should record moderation actions without storing secret keys or unrelated plaintext.

## Backup and recovery limitations

- Password reset must not automatically restore encryption keys unless a separate recovery design exists.
- Recovery phrases or recovery keys require clear UX and secure storage guidance.
- Organization or community escrow is a product/security decision, not a default.
- Lost keys can mean lost encrypted message history.

## Attachment encryption placeholder

A future encrypted attachment flow could be:

1. Validate file type and size locally.
2. Encrypt file bytes on the desktop client.
3. Upload encrypted bytes to Supabase Storage or object storage.
4. Store encrypted metadata and key-wrapping records in Postgres.
5. Generate previews only on trusted clients unless thumbnail encryption is designed.
6. Block suspicious files before decryption/download where scanning policy allows.

## Realtime and sync implications

- Supabase Realtime can carry encrypted payloads but should not receive plaintext for E2EE rooms.
- Delivery receipts can remain metadata-only.
- Message edits/deletes require authenticated envelope metadata plus encrypted body changes.
- Conflict resolution should preserve ciphertext integrity and reject unknown key versions.

## Risks

- Unsafe custom crypto implementation.
- Users believing all Picom messages are encrypted when only some spaces are.
- Lost keys causing unrecoverable data loss.
- Moderation/reporting gaps in harmful private spaces.
- Backup/export accidentally leaking decrypted content or private keys.
- Cross-device sync becoming confusing or unreliable.

## Phased implementation plan

### Phase 1: Research and threat model

- Define exact threat model.
- Choose audited cryptographic libraries.
- Decide which surfaces are eligible for E2EE.
- Write UX copy that distinguishes normal messages from encrypted spaces.

### Phase 2: Local key storage prototype

- Prototype OS-protected key storage on Windows, Linux, and macOS.
- Add device identity metadata without enabling encryption.
- Add backup/recovery UX prototypes.

### Phase 3: E2EE direct-message prototype

- Encrypt message body for a small direct-message beta.
- Keep attachments out of scope until text flow is stable.
- Add client-side report evidence flow.

### Phase 4: Attachments and private channels

- Add encrypted attachments.
- Add key rotation on membership changes.
- Add local encrypted search if approved.

### Phase 5: Security review and release gate

- Run external cryptography/security review.
- Run data-loss recovery drills.
- Update Terms/Privacy placeholders before any public claim.
- Add release checklist gates for encrypted and non-encrypted spaces.

## Current release position

E2EE is post-MVP. Picom's current MVP should continue to rely on Supabase Auth, RLS, storage rules, Electron IPC safety, and clear privacy copy. Do not market or label current MVP messages as end-to-end encrypted.
