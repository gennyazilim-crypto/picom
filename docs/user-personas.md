# Picom v3 user segmentation and personas

## Evidence status

These are product-planning hypotheses derived from current Picom surfaces, not completed user research or market-size claims. Validate them with consented interviews/usability studies and privacy-safe aggregate product signals before changing roadmap priority. Picom remains desktop-only on Windows, Linux and macOS.

## Segmentation dimensions

- Relationship: visitor, member, moderator/admin, owner.
- Participation: occasional reader, active/power member, creator/facilitator.
- Collaboration: text-first, voice/screen collaboration, integration developer.
- Governance: community-level operator versus future enterprise administrator.
- Access needs: keyboard/screen reader, high contrast/reduced motion/larger text, locale/timezone and lower-end desktop hardware.

## Community owner

**Job:** create a trustworthy organized community and delegate daily operations.

Pain points: confusing setup, permission mistakes, moderation overload, weak health signals, ownership-transfer risk. Picom fit: community/channel creation, role-aware admin panel, invites, aggregate insights, audit/safety workflows and owner-only danger controls.

Metrics: setup completion/time, first member/channel/message, invited-to-joined conversion, active-channel ratio, owner support contacts, moderation backlog and permission-denial/leak incidents. Never rank owners by private member behavior.

## Moderator

**Job:** resolve harm consistently without unnecessary access to private content.

Pain points: missing context, unclear authority, repetitive reports, irreversible actions, weak appeal/audit trail. Picom fit: scoped moderator panel, report queue, message/member actions, audit events, guidelines and appeals.

Metrics: acknowledgement/resolution time by severity, reopen/appeal overturn rate, aged backlog, unauthorized-action denial and moderator error/support rate. Speed never outweighs accuracy, proportionality or privacy.

## Power member

**Job:** stay current, contribute frequently and coordinate across channels/voice.

Pain points: mention overload, lost replies, notification fatigue, failed offline sends, hard-to-find people/context. Picom fit: Mention Feed, following, profiles, search/command palette, replies/reactions, drafts, notification controls, queue recovery, voice/screen share.

Metrics: important mention opened/read, open-in-channel success, send/reply/reaction success, search success, queued-message recovery, mute/notification opt-out and crash-free active sessions.

## Visitor

**Job:** evaluate a public community safely before joining.

Pain points: unclear rules/value, accidental participation, private-channel leakage, forced signup/join. Picom fit: public read-only metadata/channels, community info/guidelines, explicit Join action and disabled composer/private filtering.

Metrics: eligible public-page load success, info/rules view, join conversion, join cancellation, unauthorized private read/write denial and report accessibility. Do not optimize conversion through hidden consent or artificial urgency.

## Creator / facilitator

**Job:** run recurring discussions, events or collaborative sessions and help people discover useful contributions.

Pain points: fragmented media/activity, weak event visibility, difficulty recognizing contributors, voice-session coordination. Picom fit: profiles/media/activity, stories/mentions, events, announcement/forum foundations, voice mini card and screen share.

Metrics: event attendance/return, relevant story/mention engagement, activity open-in-channel success, session join/recovery and creator retention. Popularity must not override safety, access or anti-gaming controls.

## Restricted integration developer

**Job:** automate approved community tasks through scoped bots/webhooks.

Pain points: unsafe credential handling, unclear permissions/rate limits, inconsistent events/errors, no test boundary. Picom fit: restricted developer portal/docs, scoped bot credentials, webhook signing/rate/idempotency and audit metadata.

Metrics: authorized request success, rate-limit/invalid-signature rate, token rotation/revocation success, abuse/security events, time to first safe test integration and support volume. Public publishing/marketplace and arbitrary desktop code remain excluded.

## Enterprise administrator (future validation persona)

**Job:** govern organizational identity, deployment, retention and support across managed workspaces.

Pain points: identity lifecycle, policy/audit/retention proof, controlled deployment, residency/support expectations. Potential future fit: SSO/SCIM, organization policy, audit export, deployment and support runbooks.

Metrics would include provisioning/deprovisioning correctness, unauthorized access, policy drift, audit delivery and support SLA. This persona does not authorize enterprise runtime work; validated customer demand, legal/security architecture and operational capacity are prerequisites.

## Cross-persona priorities

All personas need reliable startup/auth/chat, clear permission errors, private-data isolation, accessible keyboard/screen-reader behavior, locale-aware time, safe attachments, recoverable failures and honest degraded/placeholder states. Core reliability and safety metrics override growth metrics.

## Research plan

Recruit synthetic/staging-safe sessions across roles, platforms, access needs and community sizes. Test first-run, public evaluation/join, mention-to-channel, message recovery, moderation, voice permission loss and settings/privacy. Record only consented, minimized, redacted evidence; do not capture private messages/screens/credentials. Revisit personas quarterly or when validated evidence contradicts assumptions.
