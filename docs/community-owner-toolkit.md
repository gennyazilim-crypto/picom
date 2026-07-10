# Community owner toolkit plan

Status: product and delivery plan; no new owner feature is enabled by this document  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Objective

Give community owners a coherent desktop toolkit for setup, growth, safety and ongoing operations without forcing them to learn scattered menus or exposing invasive member analytics. The toolkit composes existing Picom foundations and clearly separates ready, production-gated and future capabilities.

## Users and access

- **Owner:** full toolkit, ownership-only danger actions and final responsibility for roles/policy.
- **Admin:** only sections granted by explicit permissions such as `manageCommunity`, `manageChannels`, `manageRoles`, `manageMembers`, `createInvites`, `viewAuditLog` and `viewInsights`.
- **Moderator:** moderation workspace only; no owner growth/settings dashboard by default.
- **Member/visitor:** no owner toolkit.

Frontend gates are UX. Every read/mutation must be re-authorized by RPC/RLS. Toolkit payloads must never include invite codes in list responses, message bodies in metrics, reporter identity, tokens, private credentials or unauthorized private-channel data.

## Proposed desktop information architecture

Reuse the Community Management Center rather than adding a separate application shell:

1. **Overview**: setup checklist, health notices and safe next actions.
2. **Community**: public information, icon/description, welcome and rules.
3. **Channels**: categories, text/voice channels and ordering.
4. **Roles & members**: role hierarchy, assignments and member actions.
5. **Invites**: create/revoke and aggregate campaign status.
6. **Announcements & events**: scheduled communication surfaces.
7. **Insights**: privacy-safe aggregate metrics.
8. **Moderation & audit**: reports, moderation actions and immutable audit facts.
9. **Danger zone**: ownership transfer and deletion only after separate production approval.

Sections remain permission-filtered. Denied deep links show a compact permission error instead of rendering partial data.

## Capability maturity map

| Capability | Current foundation | MVP-ready now | Production-gated next | Future only |
| --- | --- | --- | --- | --- |
| Owner onboarding checklist | Local per-community/user checklist with eight stable items | Show/dismiss locally for Owner/Admin | Persist non-sensitive completion state server-side after RLS | Adaptive recommendations/experiments |
| Invite management/analytics | High-entropy codes, create/revoke/accept RPCs, campaign labels and aggregate use counts | Mock/manual link lifecycle | Hosted concurrency, RLS and rate-limit validation | Referral rewards or automated outreach |
| Welcome screen and rules | Typed local rules/acceptance foundation | Informational rules editor placeholder/local flow | Versioned rules, required acceptance and RLS-backed membership gate | Conditional/segmented onboarding journeys |
| Announcements | Announcement-channel production foundation exists | Basic channel-based publishing where current permissions support it | Scheduling, delivery status and notification preference enforcement | Campaign automation/cross-channel marketing |
| Events | Scheduled-session/event foundation exists | Local/basic event display and RSVP where implemented | Authoritative event persistence, timezone/reminder and permission QA | Ticketing, commerce or external event marketplace |
| Insights | Permission-checked service, mock aggregate and Supabase RPC path | Mock aggregate dashboard | Apply/validate migration and privacy thresholds in hosted staging | Predictive growth or user-level analytics |
| Channels/roles/members | Existing management center and permission helpers | Current guarded MVP operations | Hosted RLS, hierarchy and audit validation | Complex conditional permissions until model review |
| Moderation/audit | Reports, abuse/audit foundations and restricted views | Existing role-aware placeholders/foundations | Staff workflow, retention, immutable audit and hosted tests | Automated punitive decisions |

`MVP-ready` means the existing constrained behavior may remain; it does not claim hosted production evidence.

## Owner onboarding checklist

### Checklist

1. Set community icon.
2. Add description.
3. Create first permitted text channel.
4. Publish rules.
5. Configure default roles.
6. Invite people.
7. Send first message/announcement.
8. Review notification and moderation defaults.

### Behavior

- Show only to Owner/Admin with setup permission.
- Each item links to the exact existing management section.
- Completion derives from authoritative state where possible; manual dismissal remains reversible.
- The checklist can be hidden permanently per owner/community without losing configuration.
- Never block members, chat or community switching.
- Do not gamify completion, show public percentages or compare owners.

Current local `picom.communityOnboarding.v1` state is non-sensitive and resettable. Future server state should store stable item IDs/completion timestamps only, not drafts, message content or member data.

## Invite campaigns and analytics

### Owner view

- Campaign label, creator, created/expiry/last-used times.
- Maximum uses, aggregate uses and active/revoked/expired state.
- Create with bounded expiry/use cap; copy the newly issued link explicitly.
- Revoke with confirmation and append-only audit event.

### Privacy and safety

- Campaign lists never return raw codes or redemption identities.
- No IP, device, referrer, fingerprint, contact data or cross-community attribution.
- Do not expose who accepted each invite as growth analytics.
- Rate limits, concurrency-safe acceptance, ban checks and default-role assignment require hosted evidence.
- Optimize healthy retained membership, not links created or raw joins.

Future referral/source aggregation follows `docs/referral-invite-growth.md` and stays disabled until opt-out/reporting/legal gates exist.

## Welcome screen and rules

### MVP-ready presentation

- Community name/icon/description.
- Concise owner-authored welcome text.
- Ordered rules with clear required labels.
- Safe links only through the centralized external-link service.
- Continue/Cancel; no auto-accept.

### Production requirements

- Versioned rules and acceptance timestamp/version per member.
- Authoritative acceptance RPC and RLS-backed participation restriction.
- Rule edits trigger reacceptance only under approved versioning policy.
- Owner/admin editing permission; members read only; visitors see only approved public rules.
- Audit create/edit/publish actions without duplicating full sensitive text in logs.
- Accessible keyboard/focus behavior and Turkish/English copy QA.

Welcome content must not execute HTML/scripts, request credentials or embed untrusted remote content.

## Announcements

MVP-ready scope:

- Owner/admin publishes to an authorized announcement channel.
- Normal message safety, attachment access and notification preferences remain in force.
- Read-only followers/members cannot publish unless explicitly permitted.

Production-gated additions:

- Draft/scheduled publish with timezone shown.
- Explicit audience preview and permission validation at send time.
- Delivery aggregate without per-user surveillance.
- Edit/cancel rules, audit event and idempotency.
- Quiet-hours/DND-aware native notifications; inbox still records permitted events.

Future exclusions: mass email marketing, sponsored posts, automated cross-community broadcast and public advertising marketplace.

## Events

Owner workflow:

- Create title, description, start/end, timezone, host, event type and permitted location/channel.
- Preview visibility and attendee access before publish.
- View aggregate RSVP/participant count and update/cancel with confirmation.
- Open event/voice channel from the desktop community context.

Production gates:

- Server-authoritative timezone storage, validation and versioned updates.
- RLS for public/member/private events and channel visibility.
- Reminder idempotency, notification preferences and quiet hours.
- Voice event depends on LiveKit availability and does not claim a guaranteed room until token/join succeeds.
- No attendee identity export by default.

Future exclusions: ticketing, payments, commerce tax handling and public event marketplace.

## Insights

Approved aggregate dimensions:

- Total/new/active member counts with thresholding.
- Confirmed messages and active permitted channels in bounded windows.
- Top-channel counts only for channels the viewer may access.
- Aggregate voice session/participant-minute/peak concurrency totals without user IDs.
- Open/total report counts without reasons, reporter identity or evidence.

Required UI context:

- Window, timezone, data freshness, source (mock/staging/production) and insufficient-data state.
- Plain-language metric definition; no causal claims.
- No member ranking, productivity score, private-content sample or individual activity timeline.

The existing `get_community_insights_v2` path remains production-gated until migration/RPC tests pass for owner, admin, moderator, member and visitor roles.

## Safe owner notifications

Toolkit notices should be actionable and sparse:

- Setup item incomplete.
- Invite nearing expiry/use cap.
- Required listing/rules re-review.
- Unresolved report age band.
- Scheduled event/announcement failure.
- Service degradation affecting an owner operation.

Do not create engagement nags, public shame, artificial urgency or repeated dismissal-resistant prompts.

## Service boundaries

UI components call service abstractions, never `supabase.from` directly. Recommended domain services:

- `communitySettingsService`
- `communityRulesService`
- `communityInviteService`
- `communityEventsService`
- `announcementService`
- `communityInsightsService`
- `auditLogService`

Mutations use typed error codes, idempotency where retry is plausible and audit writes inside the same transaction when required. Realtime notifications occur only after transaction success.

## Owner toolkit release slices

### Slice A: dependable setup

- Existing checklist, direct links to settings, channel/role/rule setup and safe empty states.
- No new schema required for local checklist behavior.

### Slice B: hosted operational controls

- Community settings, rules, channel/member/role operations, invites and audit paths validated against hosted RLS.
- Negative role/cross-community tests are mandatory.

### Slice C: communication

- Announcements/events with timezone, idempotency, notification preference and audit evidence.

### Slice D: privacy-safe insights

- Thresholded aggregate dashboard after migration, formula and authorization validation.

### Slice E: future growth tools

- Opt-in Discovery listing, quality review and creator growth experiments only after staffed moderation and governance approval.

## Success criteria

- New owner can reach a usable community setup without external documentation.
- Permission-denied and unavailable states explain the next safe action.
- Invite/rules/channel/member changes are authoritative and audited.
- Owner can identify operational issues without seeing private member behavior.
- Toolkit does not increase report abuse, accidental destructive actions or permission leaks.
- Desktop layout remains compact, keyboard accessible and stable at supported minimum size.

## Non-goals

- Billing, paid memberships, courses, storefronts or creator payouts.
- Bot/plugin marketplace or unrestricted automation.
- Public Discovery/ranking activation in this task.
- User-level growth analytics, contact import or referral spam.
- Enterprise administration, SSO or SCIM.
- Mobile/web owner console.
- Any code, UI, schema or runtime change in this planning task.
