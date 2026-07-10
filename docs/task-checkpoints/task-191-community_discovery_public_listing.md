# Task 191 Checkpoint: Community Discovery Public Listing

The existing production implementation was audited and retained without duplicate architecture.

- Public cards expose only name, description, icon, accent, category, aggregate member count, and join policy.
- Database listing requires `approved`, `public`, `discovery_listed`, and `public_read_enabled` simultaneously.
- Authenticated users can open-join or create a moderated access request according to community policy.
- Community reports flow through the existing restricted ReportModal/report service.
- Private communities, channels, messages, members, invite secrets, audit data, and moderation metadata are not returned by the listing RPC.
- Rollout remains feature-controlled and operational moderation approval is still required.

Validation: `npm run discovery:public:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
