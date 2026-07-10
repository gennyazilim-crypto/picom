# Chaos testing and resilience drills

## Safety policy

Picom resilience drills run only in local mock mode or an isolated, approved staging environment with synthetic data. **No destructive or fault-injection test may target production.** Provider outages, credential revocation, database/network/firewall changes, object deletion, DNS changes and resource termination require a separate reviewed production game-day process and are not authorized here.

Every staging drill needs owner, observers, target allowlist, time window, synthetic accounts/data, hypothesis, steady-state checks, blast radius, abort threshold, recovery command, backup evidence, communication and cleanup.

## Shared steady state

Before injection verify:

- desktop starts and current UI remains visible;
- Auth/session is valid for synthetic account;
- community/channel/messages load;
- one optimistic message confirms and appears in second client;
- valid image upload/preview works;
- voice token/join/leave works where configured;
- health/ready and safe monitoring are available;
- logs/diagnostics are redacted and clocks synchronized.

Record version/commit, Windows/Linux/macOS client, environment/region, request IDs, timing and aggregate outcomes without tokens, passwords, URLs, paths, message content or private data.

## Drill A: Supabase unavailable

### Hypothesis

Existing desktop content stays visible, new API actions fail safely, network status shows backend unavailable/degraded, no auth/session secret is exposed, retries remain bounded, and recovery does not duplicate writes.

### Safe staging injection

Use a local fault proxy or staging-only endpoint override to reject/timeout the app's Supabase requests. Do not delete/stop the project, change production DNS, rotate keys, edit RLS, or corrupt data. Exercise short timeout, 503 and connection reset separately.

### Expected user state

- compact “Backend unavailable”/degraded indicator;
- current community/channel/message UI is not cleared unnecessarily;
- recoverable actions show retry and preserve local text;
- login/register show friendly unavailable/timeout error;
- no raw provider/stack/config message;
- Settings Diagnostics reports safe network/service state.

### Verify recovery

Remove proxy fault, wait for debounced health/session refresh, refetch active data, reconnect realtime and flush only idempotent offline actions. Confirm no duplicate messages/community/channel creation and no fetch storm.

## Drill B: Realtime disconnect/event disruption

### Hypothesis

Realtime status changes to reconnecting/disconnected, API/local UI remains usable, typing/presence are safely stale/coalesced, reconnect resubscribes once, event-ID/clientMessageId reconciliation prevents duplicate/out-of-order corruption.

### Injection

In local mock/dev controls or staging fault proxy, close WebSocket, delay events, replay one event ID, deliver older update after delete, and reconnect repeatedly within bounded count. Do not flood provider or join unauthorized rooms.

### Expected user state

- subtle reconnecting indicator, not blocking modal;
- message composer follows offline/API queue policy;
- deleted message does not reappear;
- current channel remains visible;
- typing/presence expire safely;
- no duplicate listener/subscription growth.

### Recovery checks

One subscription per active scope, sync gap/refetch, ordered queued sends, no duplicates, presence restored, reconnect counter stabilizes and memory/listeners remain bounded.

## Drill C: LiveKit/token unavailable

### Hypothesis

Core text chat remains healthy. Voice join shows a safe unavailable/retry state, existing local tracks stop on failed/left sessions, no token/provider error is exposed, and recovery permits a fresh join without duplicate participants/tracks.

### Injection

Use staging function fault response `503 VOICE_NOT_CONFIGURED`, token timeout/rate limit, or a staging-only invalid/unreachable LiveKit endpoint through controlled config. Never log a returned token, change production secret or create real high-volume rooms.

### Expected user state

- “Voice temporarily unavailable” or configuration/rate-limit message;
- join button becomes retryable, not infinite spinner;
- mute/deafen/leave controls remain consistent;
- text chat, feed, profile and attachments unaffected;
- Diagnostics shows coarse LiveKit unavailable/degraded only.

### Recovery checks

Restore staging config/service, request a new token, join/leave, stop tracks, verify one participant identity and no stale screen share/device lock.

## Drill D: Storage/upload failure

### Hypothesis

Selected attachment remains recoverable; upload shows failed/retry/remove, message send waits for successful uploads, no incomplete attachment becomes public, no object URL/path leaks, and text-only chat continues.

### Injection

Use local mock upload-failure control or staging proxy to return timeout, 413, 415, 429 and 503. Test metadata success/object failure and object success/metadata failure only with generated fixtures and planned cleanup. Do not delete real objects or loosen bucket policies.

### Expected user state

- failed/canceled state, progress stops, retry/remove/copy text remains available;
- clear size/type/rate-limit/unavailable copy;
- suspicious/failed scan stays blocked;
- no broken public image or raw path/signed URL;
- no duplicate upload on unsafe automatic retry.

### Recovery checks

Retry once with stable idempotency, attach/send successfully, preview thumbnail/full image, verify orphan report/cleanup dry-run and revoke local object URLs.

## Combined degradation drill

Only after individual drills pass, simulate Realtime unavailable while API remains online, then Storage unavailable while text send works. Do not combine Supabase/Auth outage with destructive data operations. Goal is to prove optional-service failure does not take down core desktop UI/text chat.

## Metrics

- detection and user-indicator time;
- error/retry/reconnect counts and latency;
- queued/recovered/failed actions and duplicates;
- fetch/socket/listener/timer counts where measurable;
- core flow availability during optional outage;
- time to restore steady state;
- redaction/diagnostic correctness;
- unexpected data/object/participant changes.

These drill results are staging evidence, not production SLO measurement.

## Abort criteria

Stop immediately for wrong/production target, private-data or secret leak, data corruption/deletion, unauthorized access, unbounded retry/fetch/event/log storm, cost alarm, provider policy breach, inability to restore, or observer request. Preserve redacted evidence and follow incident response if impact escapes staging.

## Recovery order

1. Stop injector/load and confirm target.
2. Restore endpoint/proxy/config without exposing secrets.
3. Verify health/readiness/provider status.
4. Refresh session/data then reconnect Realtime/voice.
5. Reconcile idempotent queues, attachments/orphans and presence.
6. Run core staging smoke and integrity/private-access checks.
7. Clean synthetic data/resources and record result.

## Result template

- Drill/date/version/commit/environment/region/platform
- Owner/observers and approved window
- Hypothesis and steady-state evidence
- Injection method/duration/blast radius
- Expected versus actual user state
- Metrics, aborts and safe logs/request IDs
- Recovery/cleanup verification
- Security/privacy findings
- Pass/fail/blocked decision
- Actions with owner/due date

## Promotion gates

All four individual staging drills pass twice; recovery is deterministic; user-facing states are clear; no secrets/private data; retries/backpressure/idempotency verified; runbooks/monitoring/on-call ready. A production game day requires a separate change approval, customer-impact analysis, provider coordination and rollback authority.
