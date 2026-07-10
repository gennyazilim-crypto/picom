# Community Health Scoring V2

Status: Privacy-safe planning specification; no production score enabled

## Decision

Picom should not expose a single opaque community score or rank individual users. A V2 health view should present a small set of aggregate, explainable dimensions with freshness, confidence and privacy thresholds. It is an owner/admin decision aid, not moderation evidence, discovery ranking, monetization eligibility or an automated enforcement system.

## Goals

- Help authorized community owners/admins notice engagement or safety trends.
- Separate activity from safety; high activity is not automatically healthy.
- Use aggregate counts/ratios without message, voice or attachment content.
- Avoid identifying, ranking or profiling individual members.
- Make every signal understandable, bounded, time-windowed and correctable.

## Proposed dimensions

### Activity

- Active days in the selected window.
- Count of confirmed messages, reactions and active public/permitted channels.
- Event participation count where events are implemented.

Do not include text, topic analysis, author identity, exact per-user totals or private-channel labels.

### Retention

- Aggregate percentage of eligible members active in both previous and current windows.
- New-member activation as a thresholded aggregate.
- Returning-member count bucket.

Do not show member-level return/churn lists. Do not calculate when the eligible cohort is below the approved privacy threshold.

### Reports and safety

- Open/reviewed/actioned report counts and median age bucket.
- Suspicious/quarantined attachment aggregate.
- Rate-limit/abuse-event aggregate by bounded class.

Reports are not proof of wrongdoing. Do not expose reporter/reported identity, message evidence, private content or raw reason in health metrics.

### Moderation actions

- Aggregate counts of timeout/kick/ban/message-removal actions by bounded type.
- Appeal accepted/denied/pending counts when available.
- Audit coverage and unresolved-review age bucket.

Do not rank moderators or members. A rise may reflect better enforcement, abuse, policy change or reporting awareness and requires human interpretation.

### Unread load

- Aggregate channel unread-event volume bucket.
- Percentage of eligible members with high unread load only when cohort threshold is met and definitions are transparent.
- Announcement frequency and notification-default change counts.

Never expose per-user read state, detailed presence or individual attention patterns. Unread load is an experience signal, not productivity monitoring.

### Voice usage

- Voice room sessions and participant-count buckets.
- Join success/failure ratio from content-free operational events.
- Aggregate duration bucket only if approved and cohort-safe.

Do not record who spoke, speech/audio content, speaking duration by user, room names, participant graph, device details or screen-share content.

## Windows and thresholds

- Default windows: 7 and 28 complete days, with previous-period comparison.
- Exclude current partial day from comparisons unless clearly labeled.
- Minimum cohort proposal: at least 10 eligible members and at least 5 contributing events; final threshold requires privacy review.
- Suppress rather than zero-fill metrics below threshold.
- Round/bucket low counts and show `insufficient data` rather than enabling inference.
- Display timezone, window and data freshness.

## Explainable health bands

If a summary band is approved, use `insufficient_data`, `stable`, `watch` or `needs_attention`, calculated from versioned rules. Never expose a 0-100 precision that implies unsupported certainty.

Rules must:

- show which dimensions contributed;
- separate reliability, engagement and safety;
- require at least three eligible dimensions;
- cap any one dimension's influence;
- avoid private/public community comparison;
- exclude protected or sensitive attributes and identity;
- support rule version, audit and rollback;
- never trigger automated suspension, ranking or pricing.

## Suggested aggregate DTO

```ts
type CommunityHealthSnapshot = Readonly<{
  communityId: string;
  window: "7d" | "28d";
  generatedAt: string;
  rulesVersion: string;
  status: "insufficient_data" | "stable" | "watch" | "needs_attention";
  dimensions: ReadonlyArray<{
    key: "activity" | "retention" | "safety" | "moderation" | "unread_load" | "voice";
    state: "unavailable" | "stable" | "watch" | "needs_attention";
    aggregateValue?: number;
    unit?: "count" | "percent" | "bucket";
    explanation: string;
  }>;
}>;
```

The backend must infer `communityId` from the authorized request context where practical; clients must not use this DTO to access other communities.

## Authorization and privacy

- Backend/RLS authorizes owner/admin or a dedicated `viewInsights` permission.
- UI role checks are presentation only.
- Normal members, visitors and integrations receive no private health snapshot.
- Queries return only aggregates and apply cohort suppression server-side.
- No message/attachment/voice content, user IDs, names, emails, IPs, tokens, raw audit/report reasons or per-user timelines.
- Health data must have approved purpose, retention, region, access audit and export/deletion handling.
- Metrics are not shared with public discovery, advertisers or unrelated communities.

## Data quality and abuse resistance

- Use confirmed server facts, not optimistic client events.
- Deduplicate messages/actions and exclude mock/test/bot traffic where reliably labeled.
- Define joins/leaves/deleted/anonymized users consistently.
- Mark missing provider periods and schema/rule changes.
- Rate limit snapshot generation and cache only aggregate output for a short period.
- Monitor attempts to game activity through spam; do not reward volume alone.

## UI placeholder rules

If added to Community Settings > Insights later:

- show six compact aggregate dimension cards, window/freshness and `insufficient data` states;
- include explanations and links to safe actions such as review reports or adjust notification guidance;
- do not show league tables, member rankings, private content samples or alarmist colors;
- use Picom desktop tokens/AppIcon and preserve the existing layout;
- hide/deny access when backend permission fails.

No UI was added in this task because production aggregate queries, privacy thresholds and authorization evidence are not yet approved.

## Validation before implementation

1. Approve purpose, definitions, thresholds, retention and access with privacy/security/product.
2. Write RLS/adversarial tests for owner/admin/member/visitor/cross-tenant access.
3. Validate aggregate formulas against non-sensitive staging fixtures.
4. Test low-cohort suppression, missing data, deleted users and private-channel boundaries.
5. Review explanations for misleading causal claims or punitive use.
6. Stage behind a disabled-by-default feature flag and audit access.
7. Confirm no public ranking, automation or user-level export is possible.

## Non-goals

- Individual user health, engagement, productivity, risk or loyalty scores.
- Message sentiment/topic analysis.
- Moderator/member leaderboards.
- Public community ranking or automated recommendations.
- Automated moderation, suspension, pricing or monetization decisions.
