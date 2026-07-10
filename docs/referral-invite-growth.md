# Referral and invite growth plan

Status: planning only; no referral automation or new invite behavior is enabled  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Objective

Help users intentionally invite people who are likely to benefit from a Picom community while preventing unsolicited outreach, secret leakage, coercive growth loops and private-community discovery. Referral growth is acceptable only when the inviter, recipient and community retain clear control.

## Current foundation

Picom already has a useful invite baseline:

- Random 18-byte invite codes rendered as `picom://invite/{code}`.
- Invite format validation and normalized deep-link handling.
- Optional expiration, maximum uses, revocation and campaign labels.
- Permission-gated creation/revocation RPCs and manager-only campaign summaries.
- Atomic invite acceptance with row locking, duplicate-membership handling, ban checks and default-role assignment.
- Audit events for create, revoke and accept.
- Campaign summaries intentionally omit codes, redemption identities, IP addresses, devices, referrers and fingerprints.

Production gaps that this plan does not hide:

- Hosted RLS/RPC behavior still needs staging validation.
- Invite creation, lookup and acceptance need explicit rate-limit evidence.
- The renderer currently receives a raw code after creation so the user can share it; storage/log/clipboard exposure needs threat review.
- Campaign labels are operator-entered metadata, not a trustworthy referral source.
- There is no recipient-facing invite opt-out or abuse report path yet.
- No referral attribution, reward or notification system is implemented.

## Terminology

- **Invite code:** high-entropy bearer secret authorizing a join attempt under its limits.
- **Invite link:** Picom deep link containing one invite code.
- **Invite campaign:** one managed invite record with optional human label, expiry and use cap.
- **Referral source:** coarse, server-assigned context describing how the invite was intentionally shared; never a pasted URL, contact identity or arbitrary tracking string.
- **Inviter:** authenticated member authorized to create/share an invite.
- **Recipient:** person who receives a link and chooses whether to open and accept it.
- **Acceptance:** authoritative membership creation; link opens and previews are not conversions.

## Principles

1. Sharing is always initiated by the user; Picom never contacts recipients automatically.
2. Opening a link never joins a community automatically.
3. A recipient sees safe community context and confirms before membership is created.
4. Invite codes are secrets: never analytics dimensions, log fields, URLs sent to third parties or campaign-list payloads.
5. Rewards, if ever approved, cannot be based on raw invite volume or encourage low-quality/spam behavior.
6. Private-community metadata remains server-authorized and minimal before acceptance.
7. Frontend permission checks improve UX; RLS/RPC enforcement is authoritative.

## Invite-code lifecycle

### Creation

- Require authenticated membership and `createInvites` permission.
- Generate code server-side in production using a cryptographically secure source.
- Encourage bounded defaults: 7-day expiry and a modest use cap; unlimited/long-lived links require elevated permission and explicit warning.
- Reject past expiry, expiry beyond the approved maximum and invalid use limits.
- Return a raw code only once to the authorized creator where feasible; manager lists return metadata without code.
- Record a redacted audit event containing invite ID and campaign label, never the code.

### Preview

- Normalize and validate locally before network access.
- Apply per-IP-hash, per-session and per-code-prefix-safe rate controls without storing the full code in abuse telemetry.
- Return only authorized fields: community display name/icon, public/private label, coarse member-count band, rules-required state, expiry state and whether sign-in is required.
- Use the same generic unavailable response for unknown, revoked and unauthorized private invites where differentiation would leak state.

### Acceptance

- Require authentication and an explicit Join confirmation.
- Lock the invite row and atomically check revoked/expired/exhausted/ban/existing-membership state.
- Create only the default Member membership, increment use count only for a new membership, and write the audit event in the same transaction.
- Make repeat acceptance idempotent for an existing member.
- Never grant owner, admin or moderator through a referral link.

### Revocation and expiry

- Authorized managers can revoke immediately; revocation is irreversible for that code.
- Expired/exhausted/revoked links show a neutral recovery state and may offer a safe request-new-invite action only if the community allows it.
- Do not silently generate a replacement.
- Retain metadata according to audit/retention policy while excluding the raw code from routine exports.

## Referral-source model

Referral attribution is optional and server-defined. Approved values should be coarse enums such as:

- `member_share`
- `owner_campaign`
- `community_event`
- `support_invite`
- `external_owned_page`
- `unknown`

Store only:

- Invite/campaign ID.
- Coarse source enum.
- Creator user ID for authorization/audit.
- Aggregate created, accepted and later-retained counts.
- Created/last-used timestamps.

Do not store:

- Recipient email/phone/contact-book record.
- Full referrer URL, UTM string, browser fingerprint or precise location.
- Clipboard contents, share target/application or message text used to send the link.
- Invite code in analytics, abuse events or support diagnostics.
- A graph of who invited whom for general browsing.

Campaign labels remain private manager notes and must be length-limited/redacted. They must not be shown to recipients or interpreted as verified source data.

## Consent-first sharing flow

1. Inviter opens the community invite surface.
2. Picom shows link lifetime/use limits and the community's invite policy.
3. Inviter creates a link and explicitly selects Copy Link or system-safe Share if later approved.
4. Picom does not ask for contacts and does not send on the inviter's behalf.
5. Recipient opens the link and sees safe context, privacy/rules notice and Join/Cancel.
6. Sign-in/register is required before acceptance but must preserve the invite locally without placing it in logs.
7. Successful acceptance opens the first permitted channel; failure provides a specific safe recovery action.

No prechecked marketing consent, auto-follow, auto-notification permission or forced inviter attribution is allowed.

## Opt-out and user control

Recipient controls:

- `Do not open Picom invite links automatically` local setting.
- `Block invite requests from this user` when authenticated identity is legitimately available.
- `Report invite abuse` without joining.
- Dismiss/close without repeated prompts.
- Clear locally preserved pending invite.

Member controls:

- Disable personal invite eligibility where community policy supports it.
- Revoke links they created if still authorized.
- See only their own invite metadata unless they can manage invites.

Community controls:

- Disable member-created invites.
- Restrict creation to specific roles/permissions.
- Require bounded expiry/use limits.
- Pause all invite acceptance with an emergency switch enforced by the backend.
- Revoke campaigns, review aggregate abuse signals and require rules acceptance.

An opt-out must take effect immediately, persist without requiring marketing consent and never reduce access to normal joined-community features.

## Spam and abuse prevention

### Preventive controls

- Rate limit invite creation per user/community and acceptance/preview per safe network/session bucket.
- Cap simultaneously active campaigns per creator and community.
- Require verified email or account-age/risk checks only if legal/privacy review approves them; do not expose the reason publicly.
- Use high-entropy codes, constant-shape unavailable responses and short bounded previews.
- Apply bans before membership creation and prevent self-elevation through role assignment.
- Validate deep links and allow only the `picom://invite/{code}` grammar.
- Do not support bulk recipient upload, automatic address-book import or repeated reminder sends.

### Detection signals

Allowed redacted signals:

- Excess create/revoke attempts by user/community.
- Excess preview/accept attempts by hashed/coarse network bucket.
- Invalid/revoked/exhausted attempt counts without raw code.
- High acceptance followed by rapid leave/block/report aggregate rates.
- Repeated attempts by a banned account.

Signals must have retention limits, access controls and false-positive review. They are not user-facing reputation scores.

### Response ladder

1. Soft throttle with retry-after.
2. Temporary creator/community invite pause.
3. Revoke affected campaign IDs.
4. Require moderator/app-admin review for repeated abuse.
5. Account/community action under approved policy with appeal path.

Never expose internal risk scores or confirm whether a private invite exists.

## Quality metrics

Privacy-safe aggregate metrics, disabled until analytics/legal approval:

- Invite campaigns created and revoked.
- Confirmed memberships per campaign/source enum.
- Median/coarse time from create to acceptance.
- Acceptance-to-7-day-membership retention rate.
- Expired, exhausted, banned and rate-limited attempt counts.
- Reported invite-abuse rate per coarse exposure band.
- Rapid-leave and recipient-opt-out rates.

Do not optimize raw links created, link opens or invitations sent. The primary success signal is an informed accepted membership that remains healthy, not viral volume.

## Rewards policy

No referral rewards are approved. If considered later:

- Reward only after a delayed quality threshold, never link creation or raw acceptance.
- No cash-like, tradable or permission-granting rewards.
- No public leaderboard of inviters.
- Anti-fraud, tax/legal, age eligibility and reversal rules require approval first.
- A reward experiment must be separately scoped and feature-flagged.

## Security and RLS requirements

- Direct table insert/update/delete remains revoked from normal authenticated clients where security-definer RPCs own mutation.
- Invite management policies must not allow members to list another creator's secrets.
- Acceptance RPC sets a fixed search path, requires `auth.uid()` and returns only resulting membership fields.
- Private community/channel/message/attachment RLS remains unchanged until membership exists.
- Backend kill switch must reject creation/acceptance; hiding UI alone is insufficient.
- Hosted tests cover owner/admin/member/visitor, banned, expired, exhausted, revoked, duplicate and concurrency cases.

## Rollout gates

Do not enable referral growth beyond existing manual links until:

- Hosted RLS and RPC tests pass with captured evidence.
- Rate limits and `Retry-After` behavior pass staging abuse tests.
- Deep-link, auth-resume and generic private-error behavior pass packaged desktop QA.
- Legal/privacy approve source fields, retention and abuse telemetry.
- Report/opt-out surfaces and moderation ownership exist.
- Monitoring detects spikes without logging raw codes.
- Emergency invite pause is tested on frontend and backend.

## Explicit exclusions

- No automatic emails, SMS, DMs, contact import or reminder campaigns.
- No public invite marketplace or community discovery coupling.
- No referral reward implementation.
- No raw-code analytics, support export or manager list.
- No mobile/web sharing flow.
- No production behavior or schema change in this planning task.
