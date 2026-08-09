# Live Now Incident Response

## Incident evidence template (do not fabricate)

```
incident id:
start time (UTC):
detected by:
severity: SEV1|SEV2|SEV3|SEV4
affected components:
user impact:
timeline:
mitigation:
root cause:
data/security impact:
recovery:
follow-ups:
correlation_ids (opaque):
```

## Stream credential compromise

1. Revoke stream credential  
2. Rotate  
3. Invalidate affected Ingress bindings  
4. Audit  
5. Upsert alert (`STREAM_CREDENTIAL_REVOKED`)  
See `STREAM_CREDENTIAL_SECURITY.md` (Task27).

## Moderation incident

Chat abuse spike / malicious moderator / mass spam / ban failure / report flood → Task28 tools (rate limit, slow mode, ban, timeout, soft delete, report). Do not upgrade two-client realtime verdict without runtime evidence.

## Account / team security

Publisher compromise, privilege escalation, finance exposure, stolen session → Task33 Security Center + studio audit. Session revocation limited by Auth provider capability (**PARTIAL_AUTH_PROVIDER_CAPABILITY**).

## LiveKit incident

Distinguish signaling vs media vs Ingress. Check DNS/TLS/443, server health, Ingress, `livekit-token` edge, websocket signaling, restart escalation.

## Supabase incident

Auth / DB / Realtime / Edge Function outage. Fail closed. **Do not bypass Auth/RLS.**

## Worker incident

Health endpoint, logs, queue depths, restart, stuck claims, retry storms, SMTP dependency. **Do not clear queues destructively.**

## Emergency Go Live kill switch

Set remote/env kill switch `disableGoLive=true` and/or feature flag `enableGoLive=false`.  
**Policy:** blocks **new** Go Live attempts. Does **not** automatically terminate all active streams unless a separate explicit operator action is taken.
