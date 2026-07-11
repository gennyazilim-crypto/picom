# Podcast Permissions, Moderation, and Audit

## Role hierarchy

Podcast access uses the common community role and capability model. UI labels never grant authority by themselves.

- Owner and Admin: publishing, metadata, archive, episode moderation, comment moderation, series management, and report review.
- Podcast Publisher: draft creation, private media, publishing, metadata, archive, and series management.
- Podcast Editor: metadata and comment moderation; no media replacement, publication-state change, or episode deletion.
- Moderator: Podcast comment moderation when the database role carries that capability.
- Member: published listening, reactions, and comments according to community policy.

Owners can assign any non-owner role. Admins can assign only roles below their own level and cannot modify equal/higher roles. The existing `assign_community_member_role` RPC applies the hierarchy and writes a `role_change` audit event.

## Moderation flow

The Podcast community contains a permission-gated Moderation section. Authorized reviewers can:

- review, dismiss, or action Podcast episode/comment reports;
- soft-delete reported Podcast comments with a required audit reason;
- unpublish or archive an episode with a required audit reason;
- inspect only the report targets their assigned capability permits.

Components use `podcastModerationService`; they do not call Supabase directly. Mock mode applies the same common permission matrix. Supabase mode uses target-aware RLS and security-definer RPCs that recheck the current authenticated role.

## Reports and copyright

Podcast episodes and visible comments can be reported for spam, harassment, unsafe content, impersonation, copyright/rights concerns, or another policy concern. Report target validation checks the episode/comment and current access before accepting the record. Reports do not contain audio files or private Storage URLs.

The Publisher workspace links Picom's Acceptable Use and Community Guidelines drafts and states that uploaders must hold the necessary rights. The engineering-specific audio policy is documented in [Audio Content Policy](legal/audio-content-policy.md). Authorized legal approval remains a separate release gate; these controls do not constitute legal advice or copyright clearance.

## Audit guarantees

The database records bounded append-only audit evidence for:

- episode publish, unpublish, archive, and delete lifecycle changes;
- episode and comment moderation actions;
- Podcast report status decisions;
- Publisher/Editor/member role changes through the common role RPC.

Audit reasons pass through the existing redaction boundary. Normal clients cannot update or delete audit rows.

## Hosted evidence

The migration and pgTAP contract can be inspected without credentials. Applying the migration and proving Owner/Admin/Publisher/Editor/Moderator/member/visitor behavior require the protected Supabase validation environment. Missing CLI or hosted credentials must be reported as blocked, never as a pass.
