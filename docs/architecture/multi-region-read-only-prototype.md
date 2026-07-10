# Multi-region read-only architecture prototype

## Status

**Architecture proof only; not approved for runtime.** This document defines a read-only routing experiment contract without adding code, endpoints, credentials, regional projects, replication, or production migration. Picom remains single-region.

The proof must first run against synthetic metadata and disposable regional environments. It cannot route real users, messages, attachments, Realtime, or LiveKit traffic.

## Proof question

Can a trusted control plane resolve a stable Picom resource to one regional data plane while:

- revealing no private tenant/resource data;
- preserving centralized secure session handling;
- requiring regional RLS authorization after routing;
- preventing wrong-region fallback and split brain;
- supporting stale-client detection, outage behavior, audit, and cost measurement?

## Read-only routing contract

Conceptual request:

```text
resolveResourceRoute(resourceType, resourceId, clientRoutingVersion)
```

Conceptual safe response:

```json
{
  "regionCode": "eu-primary",
  "routingVersion": 7,
  "migrationState": "stable",
  "apiBaseUrl": "https://regional-api.example.invalid",
  "realtimeUrl": "wss://regional-realtime.example.invalid",
  "voiceRegionHint": "eu",
  "expiresAt": "bounded timestamp"
}
```

The response contains public endpoint descriptors only. It excludes tenant name, community/channel metadata, membership, provider/project identifiers, storage paths, bucket names, credentials, tokens, signed URLs, database details, and migration internals.

Production design would bind the route response to authenticated actor/session, resource, nonce/request ID, routing version, and short expiry. Regional backend still authorizes every request; route resolution never grants access.

## Control-plane model

Synthetic proof records:

- stable resource ID/type;
- immutable home region;
- routing epoch/version;
- state: `stable`, `read_only_migration`, `cutover_pending`, `rollback_pending`, `suspended`;
- previous region during bounded migration window;
- public endpoint-set version;
- content-free audit timestamps/reason codes.

No profile/message/membership/content copy exists in the control plane. Unknown, ambiguous, suspended, or version-incompatible routes fail closed rather than trying every region.

## Authentication limitations

- Electron remains a public client and never receives regional service credentials.
- Existing Supabase session may not be portable across independent projects; project-per-region Auth design must be proven before runtime.
- A future global identity broker/session exchange would be a high-risk trusted service requiring audience/issuer/region binding, short-lived exchange, replay protection, revocation, and RLS-compatible stable UUID.
- Email/domain/JWT metadata cannot select or authorize a tenant.
- Logout/revoke/deprovision must propagate across all regions before multi-region launch.

The read-only proof may use synthetic opaque actor IDs only; it must not invent a production token-exchange mechanism.

## Storage limitations

- Object metadata and bytes remain in one owning region.
- Route resolution does not return object paths or signed URLs.
- Regional API reauthorizes and issues short-lived private URLs.
- Cross-region CDN caching, scanning, thumbnails, quarantine, exports, retention, legal hold, and backup copies are unproven.
- Migration requires checksummed object inventory/copy/verification and source disposition; database cutover alone is insufficient.

The proof may resolve a synthetic attachment owner region but must not copy/download real objects.

## Realtime and LiveKit limitations

- Realtime subscriptions connect only to the resolved regional project and still rely on Auth/RLS.
- Old route epochs must be rejected to prevent split subscriptions and duplicate messages/presence.
- Presence is not globally merged in the proof.
- LiveKit media location can differ from stored-data region; `voiceRegionHint` is routing metadata, not authorization or residency guarantee.
- Token issuance, reconnect, room move, participant disconnect, and media disclosure remain separate designs.

The read-only proof does not open sockets or rooms.

## Proposed proof harness

Use a standalone development script only after approval:

1. Load a checked-in **synthetic** route fixture with fake IDs and `.invalid` endpoints.
2. Validate resource ID/type, allowlisted region/endpoints, routing version and expiry.
3. Resolve deterministic routes without network calls.
4. Exercise stable, unknown, stale-version, suspended, migration, rollback, timeout and corrupted-fixture cases.
5. Emit only counts/status/reason codes; never resource content or credentials.
6. Assert no existing `apiClient`, Supabase, Realtime, Storage, LiveKit or Electron startup configuration is imported.

No harness is created now because regional prototype execution is not approved.

## Failure behavior

- Control plane unavailable with valid unexpired cached route: allow read-only retry only if approved; do not change regions.
- Missing/expired/ambiguous route: safe unavailable error.
- Stale routing version: refresh route before action.
- Regional backend unavailable: show regional outage; never fall back to another data plane.
- Migration/cutover state: block unsupported clients and writes according to migration contract.
- Auth audience/issuer mismatch: clear/re-auth through safe flow; never forward token cross-project.

## Operational cost model

Every region adds recurring fixed and variable cost:

- Supabase/project or self-host compute/database/storage/egress/backups;
- LiveKit/media and TURN capacity/egress;
- logs/metrics/traces/audit retention and regional security tooling;
- email/webhook/notification/job workers and queues;
- secrets/KMS/certificates/domains and rotation;
- CI migration/RLS/config parity and release certification;
- backup/restore drills, incident/on-call/support and compliance evidence;
- inter-region control-plane traffic, migration egress and duplicate source retention.

Before approval, estimate monthly fixed cost per idle region, active users/messages/storage/media minutes, egress, backup/retention, observability, staffing/on-call, migration events, support and provider minimums. Include 2x/3x outage/failover capacity assumptions separately; do not hide them in usage estimates.

## Proof success criteria

- deterministic safe route for every synthetic resource;
- no wrong-region fallback or private metadata in response/logs;
- stale/suspended/unknown routes fail closed;
- current app/runtime imports and configuration remain untouched;
- auth portability gap is explicitly unresolved rather than mocked;
- storage/realtime/voice limitations and operational cost are measured/documented;
- security/operations approve moving to disposable networked staging.

## Approval to proceed

Requires accepted Task 206 plan, tenant/identity architecture, provider project design, cost budget, legal residency claims, synthetic proof threat model, and named operations owner. Only then may a standalone non-production harness be added. Production routing and migration require a later, separate approval.
