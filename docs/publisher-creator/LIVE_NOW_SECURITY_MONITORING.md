# Live Now Security & Abuse Monitoring

## Security events (deterministic)

Codes in `src/services/ops/liveNowSecurityMonitoring.ts`:

- repeated auth denial
- stream credential rotate/revoke
- unauthorized stream management
- chat moderation abuse
- team privilege escalation denial
- finance / payout permission denial
- webhook signature failures
- RLS violations where observable
- rate-limit abuse

Counters: `bump_live_now_ops_security_counter` (hourly buckets, aggregate dimensions only).

## Abuse matrix (fail-closed expectations)

| Case | Expected |
|------|----------|
| foreign stream control | FAIL_CLOSED |
| unauthorized Go Live | FAIL_CLOSED |
| foreign credential rotate | FAIL_CLOSED |
| reused credential | FAIL_CLOSED |
| suspended publisher attempt | FAIL_CLOSED |

Chat controls reuse Task28 (rate limit, slow mode, ban, timeout, soft delete, report).  
**CHAT TWO-CLIENT runtime remains NOT_RUN** unless separately certified.

## Anomaly signals

Rule-based thresholds only (not AI fraud scoring): Go Live failure spikes, credential rotation spikes, chat flood, webhook signature failures, invite abuse.

## Webhooks

Observable outcomes: signature failure, unknown source, wrong environment, replay, malformed body, processing failure. Never log raw sensitive payloads.

## Team security (Task33)

Invite abuse, role escalation denial, finance role changes, removed-member / stale permission attempts must appear in studio audit — never log plaintext invite tokens.

## Session revocation

Do not claim Auth-provider session revocation capabilities beyond what Supabase Auth actually exposes (Task33 PARTIAL_AUTH_PROVIDER_CAPABILITY preserved).
