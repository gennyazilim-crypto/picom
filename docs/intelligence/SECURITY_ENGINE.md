# Picom Intelligence Engine — Security & Abuse Engine

**Task 06 · spam, bot, fake-account, and suspicious-login detection.** Runs on the
**Required / legitimate-interest** basis (no separate consent), content-blind, and grounds
on shipped controls: per-user rate limits (`consume_current_user_action_rate_limit`),
salted social-auth rate limits (`social_auth_rate_limits`), `community_bans` /
`community_member_timeouts`, `abuseEventService`, and report flows.

## Principles
- **Signals, not content**: detection uses behavioral shape (velocity, patterns,
  reputation), never message/DM bodies, audio, or video.
- **Privacy-preserving identifiers**: client addresses are hashed with a server-side salt
  (already done for social-auth buckets); raw IPs are never persisted.
- **Defense in depth**: rate limits + heuristics + moderation + kill switches; no single
  control is trusted alone.
- **Explainable & appealable**: each action carries a reason code; enforcement is
  reviewable in the audit log and reversible (unban/untimeout).

## Threats & signals
| Threat | Signals (content-blind) | Response |
|---|---|---|
| **Spam** | message/DM/invite velocity, duplicate-rate bucket, link ratio, new-account posting burst | rate-limit → soft-throttle → report-assisted removal |
| **Bots** | inhuman timing regularity, action bursts beyond `consume_*_rate_limit`, missing human-interaction signals | challenge / throttle / block |
| **Fake accounts** | signup velocity per salted IP bucket, synthetic-email patterns, no verification, coordinated joins | verification requirement, join gating |
| **Suspicious login** | new device/session velocity, geo/velocity impossibility (bucketed), failed-attempt bursts | step-up prompt, session review, rate-limit lockout |
| **Abuse in communities** | report rate against a user, mod actions, ban/timeout history | moderation queue, `community_bans` / timeouts |

## Architecture
1. **Ingestion** — Required security events (Task 01 §12): `suspicious_login`, `spam_signal`,
   `rate_limit_hit`, `report_submitted`, `bot_signal`. Salted-hash buckets, no raw IP.
2. **Rate-limit layer** (authoritative, server-side) — `consume_current_user_action_rate_limit`
   for authenticated actions; `consume_social_auth_rate_limit` (salted SHA-256 buckets,
   fixed window) for pre-session provider logins. Returns allow/deny + retry-after.
3. **Scoring** — per-entity reputation from decayed signal counts → risk band
   (low/medium/high). Transparent weighted sum; thresholds documented.
4. **Enforcement** — graduated: throttle → challenge/verify → temporary timeout → ban.
   All actions written to the community audit log, reason-coded, and reversible.
5. **Moderation assist** — surfaces high-risk entities and reports to human moderators;
   humans make destructive decisions. Report payloads carry a **redacted excerpt only**.

## Privacy & safety guarantees
- No message/DM content, audio, or video is read for detection or model training.
- Identifiers are salted-hashed; raw IP/geolocation are not persisted.
- `emergencyKillSwitchService` can disable risky features or tighten limits remotely
  without a deploy.
- False-positive protection: graduated responses, appeal via unban/untimeout, human review
  before permanent action.

## Interfaces
- Feeds the analytics safety metrics ([ANALYTICS_DASHBOARD.md](./ANALYTICS_DASHBOARD.md),
  Task 07) as aggregate counts only.
- Retention of security logs per [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09).
- Audited against forbidden-data rules in Task 10.
