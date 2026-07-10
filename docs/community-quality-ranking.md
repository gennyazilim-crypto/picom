# Community quality ranking plan

Status: future Discovery planning only; no production ranking is enabled  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Purpose

Define a conservative, explainable ordering system for future opt-in Community Discovery. The system should help people find active, well-run public communities without profiling individual users, rewarding spam, leaking private communities or turning moderation reports into unreviewed guilt signals.

## Non-negotiable eligibility gate

A community is not a ranking candidate unless every condition is true:

- Owner explicitly opted into public Discovery.
- Community visibility is `public` and public reading is enabled.
- Listing is approved by the staffed moderation review queue.
- Public profile has an approved name, description, category, icon and rules state.
- Listing/community/owner is not suspended, deleted, under active safety hold or awaiting required re-review.
- Minimum age/activity and moderation-readiness thresholds are satisfied.
- Backend RPC/RLS independently confirms eligibility.

Private, invite-only, unreviewed, rejected or delisted communities never enter the candidate set, feature store, search index, ranking logs or result cache. A frontend feature flag is not an authorization boundary.

Discovery remains opt-in. Creating a public community, enabling public read or meeting quality thresholds must never auto-enroll it.

## Separation from Community Health

`docs/community-health-score.md` describes a private owner/admin decision aid. Its dimensions, explanations and underlying data must not be copied wholesale into Discovery ranking.

- Health snapshots remain permission-protected and are not public scores.
- Discovery receives only separately approved, cohort-safe aggregate features.
- Private-channel activity, internal moderation detail, unread load and voice usage do not flow into ranking.
- No public `quality score` badge or precise 0-100 value is shown.
- Ranking never triggers suspension or moderation action; safety enforcement follows separate policy and human review.

## Aggregate signal families

All windows use confirmed server facts, fixed definitions, minimum cohort/event thresholds and bounded outputs. Signals are computed per eligible community, never per individual.

### 1. Sustainable activity

Allowed:

- Number of active public channels in a 7/28-day window, bucketed.
- Confirmed public messages/replies/reactions per eligible-member band, capped.
- Number of distinct active days, not exact user-level activity.
- Ratio of meaningful active days to spam-filtered event volume.

Excluded:

- Message text, sentiment, topics, author IDs or private-channel activity.
- Raw message volume without saturation/caps.
- Voice/audio/screen-share content or speaking behavior.

High volume alone must not increase rank after a modest saturation point.

### 2. Retention and welcome quality

Allowed:

- Cohort-safe aggregate percentage of legitimate new members still joined/active after 7 and 28 days.
- Aggregate join-to-first-permitted-action band.
- Rapid-leave rate band.

Excluded:

- Lists of retained/churned users, user-level lifecycle scores or cross-community identity graphs.
- Referral recipient identity or invite source beyond approved coarse campaign categories.

Do not compute when the cohort is below the privacy threshold; use a neutral cold-start state instead of zero.

### 3. Reports and safety

Allowed:

- Confirmed report rate per eligible activity/member band, with confidence bounds.
- Aggregate open-report age and resolution-time bands.
- Severe enforcement/suspension state as an eligibility hold determined by policy.
- Aggregate malicious-upload and rate-limit event bands after false-positive filtering.

Excluded:

- Reporter/reported identity, report text, message evidence or raw private context.
- Treating every report as true or allowing report brigades to directly lower rank.

Pending reports influence operational review, not automatic public punishment. Only policy-approved, confidence-adjusted outcomes can affect ranking.

### 4. Moderation health

Allowed:

- Presence of published rules and active authorized moderators.
- Aggregate median response-age bucket for reviewed reports.
- Appeal/reversal rate band as a calibration signal, not a penalty by itself.
- Audit coverage for listing/moderation actions.

Excluded:

- Moderator leaderboards, staff identities or private audit reasons.
- Rewarding high action counts; many bans/deletions can indicate either enforcement or underlying harm.

### 5. Listing completeness and reliability

Allowed:

- Approved public profile completeness.
- Valid icon/description/category/language and rules link.
- Join-flow success/error band and public endpoint reliability.
- Listing freshness/re-review state.

Excluded:

- Paid placement disguised as quality.
- Keyword stuffing, profile edit frequency or external tracking pixels.

## Explicitly prohibited signals

- Private messages, private channel names/content or private attachments.
- User profiles, bios, follows, blocks, contacts, demographics or inferred interests.
- Exact presence, read receipts, device identifiers, IP addresses or precise location.
- Individual productivity, loyalty, risk, spending or influence scores.
- Cross-community member graphs or `people like you` behavioral surveillance.
- Payment tier, advertiser relationship or operator favoritism in organic quality rank.
- Protected/sensitive attributes or proxies for them.

## Proposed ranking pipeline

### Stage 1: authorized candidate retrieval

`list_public_discovery_candidates` returns only listing IDs and approved aggregate feature bands for eligible communities. The function must be security-definer with a fixed search path, a strict output allowlist and no access to private content in its result.

### Stage 2: query relevance

Apply exact/prefix/text relevance only to approved public name, description, category and language fields. Query text is normalized, bounded and retained only as approved aggregate search-quality telemetry, never tied to identity.

### Stage 3: quality bands

Calculate versioned dimensions:

- `activity_quality`
- `retention_quality`
- `safety_confidence`
- `moderation_readiness`
- `listing_reliability`

Each dimension is `insufficient_data`, `eligible`, `strong` or `needs_review`. Raw counts are capped, normalized by approved exposure bands and confidence-adjusted.

### Stage 4: ordering

Initial ordering should be deterministic and simple:

1. Query relevance when searching.
2. Eligibility/review freshness.
3. Quality band composite with no single dimension exceeding 30% influence.
4. Diversity constraints across categories/languages and repeated owners.
5. Stable server-side tie-breaker with limited rotation for eligible cold-start listings.

Do not personalize rank by private behavior. Optional explicit category/language filters are user-controlled query inputs, not inferred traits.

### Stage 5: safety post-filter

Recheck listing suspension/hold state immediately before response and at cache read. Emergency delisting must invalidate caches promptly.

## Score semantics

An internal versioned composite may support ordering, but:

- It is not presented as objective truth.
- It is not exported as a precise public number.
- It never determines moderation guilt, pricing, monetization or account access.
- Feature definitions, caps and weights are documented and auditable.
- Historical versions are retained for incident analysis without retaining raw private data.
- Operators can explain broad factors to an owner without revealing anti-abuse thresholds.

## Cold start and small communities

- Reserve a bounded rotation pool for newly approved listings that meet safety/readiness gates.
- Use neutral priors and `insufficient_data`; never equate small with low quality.
- Apply minimum cohort suppression before retention/report rates.
- Do not require high message volume or large membership.
- Limit exposure gradually and monitor reports/join quality before expanding.
- Prevent a single established category from occupying the entire first page.

## Manipulation resistance

- Count confirmed, deduplicated server events only.
- Cap/saturate activity and reaction contribution.
- Exclude known seed, test, bot and moderator-generated fixture traffic where reliably labeled.
- Detect burst joins/messages/reactions using redacted aggregate abuse signals.
- Rate limit listing edits and re-review material changes.
- Use Bayesian/confidence adjustment so tiny samples and report brigades cannot dominate.
- Monitor coordinated report attacks separately from confirmed safety outcomes.
- Prohibit self-dealing across communities controlled by the same owner from increasing diversity exposure.
- Keep exact thresholds private while publishing the high-level factors and appeal process.

## Fairness and quality review

Before rollout and at each rules version:

- Compare exposure by approved category, language, age band and community-size band.
- Review false-positive delisting/needs-review rates.
- Check that small/new communities receive bounded discovery opportunity.
- Test whether accessibility, language or niche topics are unintentionally penalized.
- Use human review for material adverse listing decisions.
- Provide owners a correction/re-review path for stale or incorrect public metadata.

Do not collect protected attributes to optimize fairness unless legal/privacy review defines a necessary, consented and safe method. Prefer observable product categories and aggregate outcome audits.

## Owner transparency and appeal

Owners should see:

- Listing status: draft, pending, approved, needs review, delisted or suspended.
- Broad reason categories such as incomplete listing, unresolved safety review or reliability issue.
- Last review/rules-version date.
- Actions: update profile, review reports, request re-review or appeal under policy.

Owners must not see reporter identities, anti-abuse thresholds, other communities' metrics or private moderator notes. Ranking position is not guaranteed and routine movement is not appealable; policy-based holds/delisting are.

## Privacy-safe telemetry

Allowed aggregate operational metrics:

- Eligible candidate/result counts by category/language band.
- Search result click/join/request outcomes in aggregate.
- Exposure distribution by community size/age band.
- Report/rapid-leave rates by exposure band.
- Cache/ranking latency, error and stale-result rates.
- Rules version and rollback events.

Prohibited telemetry:

- Per-user discovery dossiers, exact query history tied to identity or cross-session fingerprinting.
- Private-community impressions or hidden candidate reasons in normal logs.
- Raw report evidence, message text, invite codes or member identities.

Metrics remain disabled until privacy/legal approval and an analytics decision. Operational security events use a separate bounded/redacted path.

## Rollout gates

1. Hosted tests prove private/unapproved communities are absent for anonymous, visitor and member roles.
2. Candidate DTO and logs pass sensitive-field review.
3. Staffed listing/report/re-review queues have owners and SLAs.
4. Anti-gaming fixtures cover spam activity, fake joins, reaction bursts and report brigades.
5. Cold-start/fairness review covers small and non-English communities.
6. Feature flag and backend kill switch are tested independently.
7. Ranking version, cache invalidation and deterministic rollback are exercised in staging.
8. A small internal/beta cohort runs before any broad Discovery exposure.

## Kill switch and rollback

- Backend disables ranked endpoint and returns curated/recent approved fallback or unavailable state.
- Renderer hides/blocks Discovery entry points through availability controls.
- Normal invite and joined-community chat remain operational.
- Invalidate ranking caches and preserve redacted rules-version evidence.
- Re-enable only after privacy/safety incident review and approval.

## Non-goals

- Production ranking implementation in this task.
- Public marketplace, sponsored placement or creator monetization.
- Individual user recommendation/profiling.
- Ranking private communities or private content.
- Automated moderation, suspension or legal decisions.
- Mobile/web Discovery UI.
