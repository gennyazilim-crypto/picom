# End-to-End Encryption Research

## Status

Picom messages and attachments are **not end-to-end encrypted**. Current transport/provider encryption and Supabase access controls are not E2EE: authorized backend infrastructure can process plaintext. This document is research only and adds no cryptography, keys, protocol, UI claim, or migration.

Do not design or implement a custom cryptographic protocol. Any future work requires a mature reviewed protocol/library, independent cryptography/security review, privacy/legal analysis, abuse-safety review, and cross-platform recovery testing.

## Candidate scope

### Direct messages

One-to-one DMs are the most plausible first research target because membership is small and intent is private. Even here, blocked users, message requests, multi-device membership, identity-key changes, history sync, reply/reaction metadata, delivery/read receipts, search, backup, and abuse reports complicate guarantees.

### Private community channels

Private channels are much harder: roles and membership change frequently, moderators may require lawful/safety access, large groups need efficient key rotation, history access rules differ, and server-side search/moderation/bots/webhooks/mentions/feed features depend on plaintext. “Private channel” must not be relabeled “E2EE” without an implemented and verified protocol.

Public communities, bots, webhooks, discovery, server-searchable history, and moderation queues are initial non-goals.

## What may be encrypted

Potential payload encryption could cover message body, edit content, reply excerpt, reactions when policy chooses, attachment bytes, attachment filename/MIME/thumbnail, and selected profile/media fields. Each field needs a documented leakage and compatibility decision.

Encryption does not automatically provide sender authenticity, forward secrecy, post-compromise security, deletion, deniability, traffic-analysis resistance, or secure backups. These properties require explicit protocol evidence.

## Metadata that remains visible

Routing and operations likely expose account/device IDs or opaque identifiers, conversation/community/channel membership, sender/recipient relationships, timestamps, ciphertext sizes, message counts/order, delivery failures, key/device events, online/presence/network metadata, attachment object size, report/abuse events, and client/IP data available to infrastructure.

Minimize metadata and retention, but do not claim E2EE hides it. Padding/traffic-obfuscation creates cost and performance tradeoffs and is not assumed.

## Key and device model

Research must define long-term identity keys, per-device keys, authenticated prekeys/session setup, group sender/epoch keys, forward secrecy/post-compromise behavior, device add/remove, key rotation, verification, compromised-device response, and secure deletion.

Private keys cannot live in normal localStorage, logs, diagnostics, analytics, crash reports, cloud config, or Supabase rows. Evaluate OS credential/key stores through a minimal native service and consider hardware-backed storage limitations across Windows, Linux, and macOS. Electron renderer compromise remains a major risk even with secure key storage.

Users need understandable safety-number/device verification and key-change warnings without conditioning them to ignore alerts. The server cannot silently add a device; transparency/audit mechanisms and out-of-band verification need research.

## Multi-device and membership

- New devices need explicitly approved history behavior: no history, encrypted transfer from an existing device, or user-controlled encrypted backup.
- Offline devices require epoch/key update delivery without letting removed devices decrypt future messages.
- Group membership/role changes trigger rotation and may not revoke plaintext already downloaded.
- Simultaneous sends, out-of-order events, edits/deletes/reactions, offline queue, and restore must preserve cryptographic state without nonce/key reuse.
- Lost/stale devices and reinstall need safe re-registration, not silent identity replacement.

## Search and product limitations

Server-side full-text message/mention/saved search cannot index plaintext E2EE content. Options are device-local indexing (sensitive local cache), no search, or carefully researched encrypted-search techniques with substantial leakage/complexity. Cross-device search and historical jump become limited.

Bots, webhooks, link previews, moderation filters, notification previews, analytics, server-generated summaries, exports, and discovery feeds cannot read ciphertext unless the user deliberately shares plaintext or grants a participant identity, which weakens the E2EE boundary. No hidden “service device” is acceptable.

## Moderation and reporting

Automated blocked-word scanning, malware/content classification, proactive abuse detection, server moderation, legal discovery, and community admin export are limited. Client-side scanning introduces surveillance, bypass, false-positive, and platform trust risks and is not assumed.

A user-initiated report could submit selected plaintext, relevant keys, and bounded context with explicit preview/consent, then protect that evidence through a separate restricted moderation path. This changes confidentiality for reported content and must be clearly disclosed. Metadata/rate/behavior abuse controls remain possible but imperfect.

## Attachment encryption

Encrypt bytes on-device before upload with a unique content key and authenticated encryption. Object storage/CDN sees ciphertext, size, timing, and object key. Keys travel only through the conversation protocol, never URL query parameters or permanent plaintext metadata.

Thumbnails/blurhash/filename/MIME/dimensions can leak content; generate encrypted derivatives on-device or omit them. Server malware scanning cannot inspect ciphertext. Client-side scan before encryption and recipient-side scan after decryption require strong sandboxing and do not guarantee safety. Do not execute decrypted files.

Signed URL/storage RLS still protects ciphertext access and cost, but is not the E2EE boundary.

## Backup and recovery

There is an unavoidable tradeoff between strong E2EE and recovery. Server-readable recovery keys defeat the intended boundary. User-held recovery keys/codes risk permanent loss, phishing, weak passwords, insecure screenshots, and support burden. Password-derived backup encryption needs reviewed memory-hard KDF parameters, versioning, rotation, rate limits, and no server plaintext.

Define whether recovery restores identity only, message history, attachments, or device trust. Support staff cannot recover keys or promise message restoration. Account deletion, ownership transfer, legal hold, data export, and inheritance policies need explicit interaction rules.

## Migration and compatibility

Existing plaintext history cannot become retroactively E2EE merely by encrypting future database rows. Migration must label security state per conversation/message, prevent downgrade/stripping, handle unsupported desktop versions, and avoid mixed-state UI deception. Server/client version negotiation and rollback cannot reuse keys/nonces or expose plaintext.

## Phased research gates

1. Threat model, security properties, metadata map, non-goals, and UX language.
2. Evaluate established protocols/libraries and licensing/maintenance; no custom crypto.
3. Independent design review and small synthetic prototype outside production accounts.
4. One-device DM test vectors, fuzzing, state rollback, and secure storage.
5. Multi-device/device verification/revocation and encrypted attachment experiment.
6. Abuse reporting, recovery, export/deletion, notification/search tradeoff review.
7. External cryptographic audit, reproducible builds, staged opt-in beta, and incident/rollback plan.

Any ambiguous key state, downgrade, nonce reuse, device injection, metadata claim, or unaudited dependency is a no-go.

## Risks

Catastrophic key/nonce bugs, renderer compromise, supply-chain attacks, compromised devices, confusing verification, permanent data loss, backup weakening, group rotation failures, metadata inference, unsupported old clients, reduced moderation, unsafe decrypted attachments, and misleading marketing are primary risks.

Until all gates pass, Picom documentation/UI must say that E2EE is not implemented.
