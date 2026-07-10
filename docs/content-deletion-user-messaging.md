# Content deletion and retention user messaging

Picom distinguishes hiding product content from final physical deletion. A deleted message becomes a content-free tombstone in its original conversation position. The renderer hides body, reactions, polls, attachments and profile actions; replies say the original message was deleted. The normal delete service writes `deleted_at` and never hard-deletes the row. A missing or anonymized author displays as **Deleted User** instead of borrowing another member's identity.

Settings > Privacy & Safety explains that no automatic production purge period is active. Deleted-message tombstones, attachments, reports/moderation evidence, immutable audit events, account/profile data, exports, logs and backups have separate lifecycles. Clearing desktop cache is not server deletion. Account deletion uses a review/grace flow and anonymization; it does not promise immediate removal from every backup or legally retained safety record.

No retention job is enabled by this task. Final periods, lawful basis, notice, user-right handling, backup expiration, legal hold conflicts, moderation evidence, restore behavior and public wording require privacy/legal/security/product approval. Until approved, Picom retains safely rather than running an accidental destructive job and must not market a guaranteed deletion deadline.
