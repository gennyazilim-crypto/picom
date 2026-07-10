# Community Templates Marketplace Plan

## Status

Picom has local built-in community templates but no public template marketplace, publishing API, remote catalog, ratings, monetization, or user-generated import. This plan defines a future reviewed capability without enabling it.

Templates are declarative community configuration only. They never contain executable code, plugins, bots, webhooks, external scripts/styles, credentials, or database entities copied from another tenant.

## Template package

Versioned schema may contain:

- template ID/version, title, bounded description, locale, category, tags, author/publisher ID, compatible Picom config version;
- community name/description placeholders and original/licensed icon/cover metadata;
- ordered categories;
- channels with safe name/type/topic/order/private/public-read placeholders;
- roles with name/color/order and allowlisted permission keys;
- notification default, moderation settings, rules, onboarding prompts, and emoji metadata placeholders;
- source/provenance, license, moderation/review status, created/updated timestamps, checksum/signature metadata.

Never include messages, threads, reactions, polls/votes, members or personal data, bans/reports/appeals, saved/read state, audit logs, analytics, invites/codes, bot/webhook tokens, auth/session data, passwords/hashes, service secrets, raw storage paths/signed URLs, LiveKit data, or legal-hold/export evidence.

## Categories and discovery

Possible marketplace categories are development, design, gaming, music, study, work, support, creator, event, and education. Search/ranking considers reviewed metadata, quality, compatibility, freshness, install success, and content-free abuse signals. It must not use private community behavior or dark-pattern engagement optimization.

Public discovery and template marketplace are distinct: listing a template does not list or expose the creator's community. No public marketplace launches until discovery moderation operations and privacy policies are ready.

## Creation and export

Owners can start from a new declarative editor or export an eligible community configuration after a preview explicitly lists included/excluded fields. Export applies the safe community config schema, strips IDs where appropriate, normalizes role/channel references, excludes private data/secrets, and creates a deterministic manifest/checksum.

Private channel names/topics, custom emoji assets, rules, and moderation words may be sensitive or licensed; default export omits or requires explicit reviewed opt-in. Export never bypasses role/visibility permissions and is audited without embedding configuration content.

## Import/install

1. Fetch catalog metadata through a versioned backend.
2. Verify schema version, size, publisher/review state, checksum/signature, asset origins, and compatibility.
3. Render a host-owned preview showing channels, roles, permission effects, private/public settings, moderation defaults, assets, conflicts, and excluded unsupported fields.
4. User chooses a new community target; importing into an existing community is initially excluded.
5. Re-authenticate/confirm, create community/owner/default roles/categories/channels in one transaction, map template references to new IDs, and apply safe defaults.
6. Commit only after validation; on failure roll back without partial community state.
7. Audit template/version/install result IDs without personal or secret content.

Template permissions are requests bounded by Picom's allowlist. A template cannot grant app-admin, ownership to another user, service role, cross-community access, bot/webhook credentials, private-channel visibility beyond standard roles, or permissions unavailable to the installer.

## User-generated publishing

Publishing requires authenticated verified account, terms/license/provenance attestations, bounded rate limits, duplicate/spam checks, asset scanning, automated schema/security checks, and manual review for public listing. Updates are versioned and reviewed; installed copies do not silently mutate.

Publisher can unlist future installs, but moderation may preserve bounded evidence. Ownership transfer, takedown/copyright, appeal, account deletion, region/age/content flags, and abandoned template handling need policy. No anonymous publishing in first release.

## Moderation

Review queue supports pending, approved, rejected, hidden, suspended, and removed states with bounded reasons and append-only reviewer audit. Check hateful/harassing/illegal content, credential phishing, malicious links, impersonation, copyrighted assets, unsafe permissions, deceptive names, evasion/duplicates, and prohibited external dependencies.

Users can report a listing from detail/install history. Emergency suspension blocks new installs and optionally warns about installed versions; it must not destructively delete communities. Operators can disable a template/version/publisher separately.

## Security boundaries

- Parse JSON with strict schema/size/depth/count limits; unknown fields fail or are safely ignored according to version policy.
- No HTML rendering, CSS injection, dynamic imports, code evaluation, shell/filesystem/native IPC, remote asset execution, or arbitrary URL fetch.
- Assets use approved storage/CDN, MIME/magic-byte validation, scan/quarantine, dimensions/size/license metadata, and safe URLs.
- Backend authorization/RLS enforce owner/export/install/review actions; feature flags only control availability.
- Deterministic IDs are never trusted across tenants; all imported records receive new server IDs.
- Rate limits/idempotency prevent duplicate publish/install and transaction rollback prevents partial state.

## Privacy

Catalog exposes only publisher-approved public profile metadata and template fields. Do not publish source community ID/name, member counts unless explicitly synthetic, private role/channel information, installer's identity, or per-user install behavior. Aggregate install health may be privacy-friendly after analytics/legal review.

## MVP exclusions and release gates

Initial future version should exclude monetization, reviews/comments, ratings susceptible to abuse, existing-community merge, executable integrations, custom code, live bot/webhook installation, private sharing links, automatic updates, and cross-region asset replication.

Release requires schema/versioning, export redaction tests, transactional import, RLS/cross-tenant tests, asset scanning, moderation queue/staffing, reporting/takedown/appeal, publisher verification, rate limits/idempotency, safe ranking, legal/license review, accessibility, staging load tests, rollback, and kill switches.

Until these gates pass, only Picom-owned local built-in templates remain available.
