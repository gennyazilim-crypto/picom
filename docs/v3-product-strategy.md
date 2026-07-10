# Picom v3 product strategy review

## Strategic position

Picom is a premium Electron desktop community chat application for Windows, Linux and macOS. V3 should win through reliable focused community participation: persistent text conversations, high-signal mentions/activity, rich member identity and dependable voice/screen collaboration. It should not compete by cloning every social, marketplace or enterprise surface.

The Task 250 No-Go evidence is a prerequisite. V3 planning does not authorize public stable claims before staging, security, accessibility, legal, packaging, monitoring and rollback gates close.

## Target personas and primary use cases

### Community participant

Joins a known public/private community, follows relevant people, reads mentions, chats, reacts/replies, shares safe images and joins voice. Success means they can find important context quickly without notification overload.

### Community owner/creator

Creates a durable space, organizes channels/roles, welcomes members and understands aggregate health without invasive individual tracking. Success means setup and governance require little operational expertise.

### Moderator/support lead

Reviews reports, applies proportionate actions, preserves audit integrity and handles appeals with least privilege. Success means high-risk work is clear, reversible where possible and never exposes unrelated private content.

### Collaborative team/gaming group

Uses channels, voice and screen share during a shared activity. Success means quick join/recovery, understandable device/permission states and text chat remains usable during media failure.

### Restricted integration developer

Builds an approved bot/webhook against documented scoped APIs. This is not a public marketplace persona until token security, review, abuse controls and support ownership are proven.

## Current surface review

| Surface | V3 role | Current assessment | Direction |
| --- | --- | --- | --- |
| Community Chat | product core | broad mock/Supabase foundations | close live RLS/realtime/upload gaps first |
| Mention Feed | differentiator | rich local UI/ranking foundations | connect only privacy-filtered, explainable Supabase data |
| Profile | identity/context | full desktop view and privacy foundations | persist follows/activity with access-aware projection |
| Voice | core collaboration | LiveKit structure/UI available | prove devices, reconnect, capacity and permission recovery |
| Screen Share | core collaboration | Electron capture + LiveKit foundation | polish preview/stop and platform permission recovery |
| Admin/Moderation | trust enabler | role-aware panels/workflows | prioritize least privilege, audit and safety; avoid enterprise sprawl |
| Bots/Webhooks | restricted extension | production-shaped foundations/docs | remain flag/permission gated, no public publishing/marketplace |

## Prioritization

### Must-have

- Stable authenticated community/channel/message/reply/reaction/read-state flows with live RLS isolation.
- Private attachment delivery and upload validation; no suspicious/private leakage.
- Mention Feed/Profile data filtered by membership, blocking and privacy settings.
- Reliable voice join/leave/mute/deafen/device/reconnect and screen-share permission recovery.
- Community role/permission/admin/moderation workflows enforced server-side.
- Legal acceptance/versioning, reporting/blocking, export/deletion request safety.
- Windows/Linux/macOS package, accessibility, observability, backup/rollback and support evidence.

### Should-have

- Public read-only community flow with safe join/invite conversion.
- Compact notification inbox with Quiet Hours/DND enforcement.
- Command/search and keyboard customization polish.
- Community owner toolkit: setup guidance, aggregate insights and moderation health.
- Performance work: lazy loading, bundle/startup/memory and desktop display QA.

### Experiments

- Guided onboarding variants, follow suggestions and referral attribution using privacy-safe aggregate metrics.
- Explainable community quality ranking with anti-gaming and moderation approval.
- Active voice-room discovery limited to communities/channels the user can access.
- Restricted bot/webhook developer beta with no public key/token display.

Experiments need hypothesis, success/guardrail metric, duration, sample/eligibility, privacy review, kill switch and stop condition. They must not manipulate private ranking, dark-pattern users or block the core free experience.

### Rejected or deferred

- Mobile application or web-first product pivot in v3.
- Discord branding/assets/colors or copied interaction identity.
- Public plugin marketplace/runtime or arbitrary desktop code execution.
- Billing/paywall before product/legal/tax/provider ownership is approved.
- Enterprise SSO/SCIM/admin console before core reliability and a validated customer requirement.
- Public discovery marketplace without moderation, age/region/content and abuse readiness.
- Production E2EE claims, analytics/crash providers or auto-update without approved implementation/evidence.
- Vanity engagement mechanics, public popularity leaderboards or invasive individual productivity/member surveillance.

## Value and success measures

North-star candidate: weekly active community participants who complete a meaningful interaction (read an important mention, send/reply/react, or join an authorized voice collaboration) without a safety/reliability failure.

Guardrails:

- message send/realtime/upload/voice success and crash-free sessions;
- time to first community/channel interaction and mention-to-channel open success;
- report response/appeal quality and unauthorized-access rate;
- notification opt-out/mute, block/report and onboarding abandonment;
- accessibility blocker count and support contacts per active desktop;
- no cross-tenant/private-channel leak, credential exposure or destructive migration incident.

Metrics remain provider-neutral and aggregate; no message body, attachment content, token, password, raw private identifier or unapproved behavioral profile.

## Strategic stop rules

Pause feature expansion when core SLO/error budget, staging isolation, legal publication, external review, platform package or rollback evidence is failing. Reject work that needs frontend-only security, production credentials in renderer, invasive analytics, arbitrary code loading, mobile UI or hidden destructive behavior.

## V3 review cadence

Product/Engineering review monthly during active v3 work; Security/Privacy/Operations review before each release candidate. Reprioritization must cite evidence, dependencies, displaced work and updated success/stop criteria. The v3 governance lock remains authoritative.
