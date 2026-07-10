# Platform Ecosystem Final Audit

Date: 2026-07-10  
Version reviewed: `0.1.1-beta.1`  
Scope: bots, webhooks, Developer Portal, plugin architecture, slash commands, custom emoji/stickers, API versioning, and abuse controls  
Decision: **Not ready for public ecosystem launch**

## Executive summary

Picom has useful post-MVP foundations and generally safe product boundaries. The strongest implementation is the incoming webhook path; bots, slash-command registration, application publishing, public API credentials, stickers, and plugin execution are intentionally incomplete or disabled. The plugin boundary correctly prohibits dynamic code loading and native access.

The ecosystem must remain private/development-only. A public API, marketplace, arbitrary plugin runtime, or production developer credential program must not be announced until server-side scopes, abuse response, versioned contracts, staging load/security evidence, and operational ownership are complete. The abuse-event quality gate currently fails and is a release blocker for external integrations.

## Verification evidence

| Check | Result | Meaning |
| --- | --- | --- |
| `npm run bots:foundation:smoke` | Pass | Bot schema/service foundation markers exist; not proof of public API operation |
| `npm run bot-api:smoke` | Pass | Architecture/security document is complete; public API remains disabled |
| `npm run webhooks:foundation:smoke` | Pass | Webhook schema, service, and server function foundation markers pass |
| `npm run developer-portal:placeholder:smoke` | Pass | Restricted placeholder UI exists; publishing/API key issuance is disabled |
| `npm run plugin-system:smoke` | Pass | Architecture explicitly forbids unsafe runtime behavior |
| `npm run slash:commands:smoke` | Pass | Local command suggestion/transform placeholder exists |
| `npm run emoji:custom:smoke` | Pass | Custom emoji foundation exists |
| `npm run stickers:placeholder:smoke` | Pass | Sticker placeholder and mock/UI contracts exist |
| `npm run api:compatibility:smoke` | Pass | Compatibility/deprecation policy exists |
| `npm run abuse:events:smoke` | **Fail** | Missing expected central redaction and Admin Operations safe-summary/copy evidence |
| `npm run typecheck` | Pass | Current TypeScript graph compiles |
| `npm run mock:smoke` | Pass | Core mock flows remain stable |

Supabase CLI/live staging execution was not part of this audit. Static smoke results do not prove deployed RLS, Edge Function configuration, rate limits, secret handling, or production load behavior.

## Readiness matrix

| Area | Current state | Safe to keep | Production/public gaps | Decision |
| --- | --- | --- | --- | --- |
| Bots | Database/service/admin foundation and token-safety architecture | Private schema/UI foundations behind flags and permissions | No certified public HTTP API/event delivery, production token lifecycle exercise, scoped read model, load test, SDK, moderation/support operation, or marketplace | Foundation only |
| Webhooks | Hashed token records, manager RLS, create/revoke UI, one-time URL, incoming Edge Function, idempotency/rate/size/type validation foundation | Controlled staging/private use after live RLS and function verification | Deployment/secrets, rotation/revocation race tests, replay/load tests, delivery observability, abuse escalation, retention, tenant-isolation and production runbook evidence | Closest to beta; not public-ready |
| Developer Portal | Restricted view exposes safe metadata/status only | Keep marked development/future; no raw token/hash display | Application CRUD/publication, ownership verification, OAuth/client model, scopes/consent, API keys, docs base URL, review/support, audit history and recovery are absent/disabled | Placeholder |
| Plugin system | Security architecture and prohibited-capability list | Keep documentation; no runtime is the safe outcome | No sandbox prototype certification, manifest/signing/review, capability broker, isolated renderer, lifecycle/update/revocation, resource limits, malware review, marketplace operations | Documentation only; do not load code |
| Slash commands | Local built-in suggestions and text transforms in composer | Keep harmless local commands | No developer registration API, server-authoritative invocation, signed interaction payload, permission scopes, timeout/retry/idempotency, audit/rate-limit and bot response model | Local placeholder |
| Custom emoji | Community schema, admin/service/UI foundation | Keep behind community permissions with safe rendering | Live storage/RLS/MIME/scan/quarantine/caching/deletion/tenant tests and quota/abuse operations need production certification | Foundation |
| Stickers | Schema plus local/mock picker/message placeholder | Keep clearly labeled placeholder | No production service/storage upload, scan/quarantine, pack ownership, permission/quota, lifecycle, moderation, delivery/caching or migration evidence | Placeholder |
| API versioning | Compatibility/error/pagination/event/deprecation policy | Keep as mandatory design policy | No public API gateway/base URL, enforced version negotiation, generated spec/SDK, deprecation telemetry/headers, support matrix automation, conformance suite, or external changelog process | Policy only |
| Abuse controls | Abuse event types/service, rate limits, Trust & Safety concepts | Keep backend enforcement and content-free aggregate intent | Current smoke failure, no certified external-integration abuse dashboard/alerts/on-call, quota tiers, automated containment, evidence retention, webhook/bot anomaly baselines or appeal process integration | **Blocker** |

## Security boundary findings

### Strong areas

- Plugin documentation prohibits dynamic imports, arbitrary JavaScript, Node/Electron/native IPC, shell and unrestricted file-system access.
- Webhook tokens are represented by hashes in storage and one-time URLs in creation flow; normal metadata views omit raw token/hash values.
- Developer Portal explicitly disables public application publishing and API-key issuance.
- Bot architecture separates backend bot identities from local desktop plugins and requires hashed, scoped, revocable credentials.
- Existing services use community permissions/RLS concepts rather than treating UI visibility as authorization.
- Slash commands do not execute downloaded or arbitrary code.

### Critical gaps

1. `abuse:events:smoke` fails for central redaction and Admin Operations safe summary/copy expectations. External bot/webhook traffic must not launch until this gate passes.
2. No clean staging RLS/adversarial suite proves bots, webhooks, emoji/stickers, and developer metadata cannot cross community/private-channel boundaries.
3. No external integration credential lifecycle drill proves creation, one-time display, prefix-only status, rotation, immediate revocation, leak response, and audit behavior.
4. No public API/event contract implementation or conformance/versioning test exists.
5. No production integration load, replay, burst, idempotency, retry/dead-letter, or provider-outage certification exists.
6. No staffed developer support, abuse response, review/signing, takedown, or marketplace moderation operation exists.

## Area-specific release requirements

### Bots

- Build a backend-only versioned API; never authenticate bots through desktop user sessions or expose service-role credentials.
- Define explicit channel/community scopes, private-channel opt-in, bot identity display, event filtering, rate tiers, idempotency, audit and revocation.
- Add token hashing with one-time display, rotation overlap policy, compromise runbook, abuse throttles, and staging adversarial tests.
- Do not build a marketplace until bot review, support, moderation, takedown, billing/fraud, and compatibility operations exist.

### Webhooks

- Deploy only behind protected server configuration and HTTPS; keep raw token out of renderer persistence/logs/diagnostics.
- Prove constant-safe token verification, revoked-token denial, JSON/content bounds, idempotent duplicate handling, rate-limit behavior, private-channel permissions, and audit redaction in staging.
- Add safe aggregate delivery metrics, alert/runbook, retry/dead-letter policy where outbound delivery is introduced, and incident response for leaked endpoints.

### Developer Portal and API

- Keep Applications/API Keys/Publishing disabled until backend models and authorization exist.
- Publish OpenAPI/typed DTO contracts, explicit version negotiation, stable error/pagination shapes, deprecation headers, changelog, supported-client matrix, and conformance tests before external access.
- Never display credentials again after creation; provide prefix/status, rotation, revoke, last-used safe timestamp, scope, and audit history.

### Plugins

- Continue with manifest-driven server integrations first.
- Any future local extension requires a separate approved ADR/threat model and isolated sandbox with deny-by-default capabilities, strict CSP/message schema, resource limits, review/signing, update/revoke, and no direct preload/native/data access.
- Do not add `eval`, `new Function`, remote scripts, arbitrary `import()`, shell, Node integration, or general file-system APIs.

### Emoji and stickers

- Use controlled object paths, validated image MIME/signature/dimensions/size, malware scanning/quarantine, signed/private delivery rules, quotas, moderation, deletion/orphan cleanup, cache invalidation, and RLS tests.
- Sticker packs require ownership, attribution/license, publication/review, lifecycle, and abuse reporting before public availability.

### Abuse controls

- Fix the current smoke failure and prove all support/admin copies remain redacted and aggregate-only.
- Add per-credential, per-app, per-community, per-operation, and IP-hash/server-signal limits without high-cardinality/private metric labels.
- Detect invalid token bursts, replay/idempotency abuse, webhook floods, bot message spam, permission probing, upload abuse, and cross-tenant attempts.
- Define automatic containment limits, manual review, false-positive handling, immutable audit, evidence retention, appeal/contact path, alerts and on-call ownership.

## Recommended delivery order

1. Fix and pass abuse-event redaction/Admin Operations smoke and manual export review.
2. Run clean Supabase migration/RLS/Edge Function adversarial tests for every ecosystem entity.
3. Certify incoming webhooks privately in staging with credential/replay/rate/idempotency/revocation/load tests.
4. Implement a versioned backend Bot API and slash-command interaction contract behind disabled-by-default flags.
5. Add Developer Portal ownership/scopes/credential lifecycle only after the backend contract is stable.
6. Production-certify custom emoji storage/scanning; keep stickers placeholder until the same pipeline is reusable.
7. Consider curated platform publishing only after review, support, moderation, abuse, incident and deprecation operations are staffed.

## Final decision

- Private architecture and disabled foundations: **safe to keep**.
- Incoming webhook staging pilot: **possible after live security verification**.
- Public Bot API, application publishing, API keys, slash registration, sticker platform, plugin runtime, or marketplace: **No-Go**.

No product code, UI, API exposure, credential issuance, plugin runtime, or marketplace behavior changed in this audit.
