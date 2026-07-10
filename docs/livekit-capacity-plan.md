# LiveKit Production Capacity and Region Plan

Status: planning baseline, not a provider migration decision  
Last reviewed: 2026-07-10

## Scope and assumptions

Picom currently targets community voice rooms and one optional screen-share track. It does not enable recording, ingress, egress, telephony, or AI agents by default. This plan keeps the approved LiveKit integration and does not authorize a provider or deployment-model change.

LiveKit Cloud meters realtime usage through connected participant minutes and downstream data transfer. Published prices and included allowances change, so release approval must use the current project dashboard and pricing page rather than values copied into application code. See [LiveKit billing](https://docs.livekit.io/deploy/admin/billing/) and the [official estimation guide](https://livekit.io/field-guides/guide/estimating-pricing-video-conference-livestream).

## Planning tiers

These are Picom planning estimates, not LiveKit guarantees.

| Stage | Concurrent rooms | Typical participants/room | Peak connected participants | Monthly participant minutes (planning) |
| --- | ---: | ---: | ---: | ---: |
| Internal | 5 | 4 | 20 | 20,000 |
| Beta | 25 | 6 | 150 | 250,000 |
| Initial production | 100 | 8 | 800 | 1,500,000 |
| Growth review trigger | 300 | 10 | 3,000 | 6,000,000 |

Before moving between tiers, load-test join/leave/reconnect, verify the account quota, and obtain a limit increase where required. As of this review, LiveKit documents a 100-participant concurrent limit on the free Build plan and explains that quotas vary by plan; the dashboard is authoritative. See [quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/).

## Bandwidth model

Picom should model bandwidth from measured track bitrates, not a fixed invoice estimate.

Formula for an SFU room:

`downstream bits/second = publisher bitrate * number of subscribers`

Illustrative voice-only example:

- 10 participants publishing an average 48 Kbit/s audio track.
- Each participant subscribes to the other 9 tracks.
- Approximate aggregate downstream: `10 * 9 * 48 Kbit/s = 4.32 Mbit/s`.
- Approximate downstream for one hour: `4.32 * 3600 / 8 = 1.94 GB` (decimal units, before protocol variance).
- Participant usage for that hour: `10 * 60 = 600 participant minutes`.

Illustrative screen-share addition:

- One 1.5 Mbit/s screen track sent to 9 viewers adds about 13.5 Mbit/s aggregate downstream.
- One hour is about 6.08 GB before protocol variance and adaptive behavior.

These examples are budget envelopes only. Actual WebRTC audio bitrate, packet overhead, packet loss recovery, screen content, quality preset, and subscriber count change consumption. Picom already enables `adaptiveStream` and `dynacast`; LiveKit documents that adaptive stream chooses layers based on rendered size/visibility and dynacast pauses unconsumed layers. See [subscribing and adaptive stream](https://docs.livekit.io/transport/media/subscribe/) and [codecs, simulcast, and dynacast](https://docs.livekit.io/transport/media/advanced/).

## Room guardrails

- Soft warning at 20 participants in a community voice room.
- Initial hard product cap at 25 participants until a measured load test approves more.
- At most one local screen-share publication per participant.
- Default screen-share preset remains balanced; higher quality is user initiated.
- Do not start recording/egress automatically.
- Disconnect abandoned sessions on explicit leave and rely on LiveKit reconnect only during transient failure.
- Keep participant and media-subscription counts in operational diagnostics without storing voice content.
- Review LiveKit's documented per-participant audio/video subscription limits before increasing room caps.

## Region and latency strategy

LiveKit Cloud uses a global mesh and connects users to nearby edges, while self-hosted LiveKit is described as a single-home SFU architecture. Picom will use the approved Cloud topology for initial production rather than introducing self-hosting. See [LiveKit Cloud architecture](https://docs.livekit.io/intro/cloud/).

Initial strategy:

1. Use the normal global endpoint for beta and measure join time, reconnect count, and anonymized connection-quality buckets.
2. Target median voice join below 2 seconds and p95 below 4 seconds under healthy network conditions.
3. Target p95 client-to-edge RTT below 150 ms for the supported launch cohort; investigate cohorts consistently above 200 ms.
4. Keep the Supabase token function close to the primary database region, but do not force media through that region.
5. Do not log raw IP addresses or precise user locations for region decisions.

If legal or contractual data-residency requirements appear, evaluate LiveKit Cloud region pinning with LiveKit support. Region pinning restricts LiveKit network traffic but is not a substitute for database, storage, backup, or analytics residency controls. See [region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning/).

## Cost guardrails

- Configure billing alerts at 50%, 75%, and 90% of the approved monthly budget.
- Alert on participant-minute or downstream-GB growth exceeding 30% week over week.
- Separate beta and production projects so test traffic cannot consume production capacity.
- Keep recording, ingress, egress, telephony, and agents disabled until separately budgeted.
- Rate-limit repeated token requests and reject unauthorized room joins before issuing a token.
- Limit screen-share quality and concurrent shares before reducing audio reliability.
- Review rooms with extreme duration, participant count, reconnect rate, or downstream usage using redacted identifiers.
- Pause expansion to the next planning tier when the projected monthly cost exceeds 80% of budget or quota headroom falls below 20%.
- Never work around provider metering or quotas; request a supported limit increase or revise the product cap.

## Capacity test gates

For each planned tier:

- Run synthetic rooms at 50%, 80%, and 100% of the proposed peak.
- Mix join/leave, mute/deafen, reconnect, and one screen-share publisher.
- Measure join success, p50/p95 join latency, reconnect success, packet loss, RTT, participant duplication, CPU, and renderer memory.
- Run Windows, Linux, and macOS clients across at least two network regions.
- Confirm token Edge Function and Supabase Auth capacity separately from media capacity.
- Confirm no private room appears in discovery or receives an unauthorized token.
- Complete a two-client manual regression before every desktop release.

## Escalation and ownership placeholders

- Product owner: approve room caps and user-facing degradation.
- Engineering owner: run load tests and maintain token/room authorization.
- Operations owner: monitor quota, cost, and region health.
- Security owner: review token claims, room isolation, and redacted diagnostics.

Escalate to LiveKit support before the expected peak reaches 80% of the project concurrency quota, before enabling region pinning, or when p95 regional latency remains above target for two consecutive observation windows.
