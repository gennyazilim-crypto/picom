# Legacy → Canonical Event Map (Task 051)

Picom currently has **two** analytics vocabularies. This map reconciles them under the
canonical taxonomy in [`event-registry.json`](../../../../src/services/analytics/event-registry.json).
Machine-readable form lives in that file's `legacyMap` (validated in CI).

## Vocabularies
- **Canonical / active** — `src/services/analytics/eventSchema.ts` (Task 02): the newer,
  typed, bucket-first schema. These are the `status: active` registry events.
- **Legacy** — `src/services/analyticsService.ts`: the older placeholder queue with a
  different event set. Mapped below; to be retired or merged into the canonical path.

## Mapping

| Legacy event (`analyticsService.ts`) | Canonical target | Status |
|---|---|---|
| `app_started` | `session_started` | deprecated → replacedBy |
| `settings_opened` | `view_opened` (`view=settings`) | deprecated → replacedBy |
| `login_success` | `auth_succeeded` | proposed-canonical |
| `community_created` | `community_created` | proposed-canonical |
| `message_sent_count_only` | `message_activity_counted` (count-only, never content) | proposed-canonical |
| `upload_success` | `upload_completed` | proposed-canonical |
| `upload_failure` | `upload_failed` | proposed-canonical |
| `voice_joined` | `voice_joined` | proposed-canonical |
| `voice_join_failure` | `voice_join_failed` | proposed-canonical |
| `screen_share_started` | `screen_share_started` | proposed-canonical |
| `feature_usage_count_only` | `feature_used_counted` | proposed-canonical |

`proposed-canonical` = no active canonical event exists yet; the name is reserved and must be
added to `eventSchema.ts` (and flipped to `active`) when its emitter is wired.

## Confirmed bug fixed under this task
Both schemas declared a `releaseChannel` metadata key (and `eventSchema.ts` also declared
`channel` on `install_activated`). The `SENSITIVE` blocklist matches `channel`, so
`sanitizeMetadata` **silently stripped** these properties — they could never be emitted.

- **Fix (canonical):** `eventSchema.ts` renamed `releaseChannel` → `releaseTrack` and
  `channel` → `releaseTrack`. The taxonomy validator now rejects any property key that
  collides with the SENSITIVE blocklist, so this class of bug cannot recur.
- **Legacy follow-up:** `analyticsService.ts` `app_started: ["runtime", "releaseChannel"]`
  has the same latent strip; rename to `release_track` when that path is retired/merged.
  Left untouched here to keep Task 051 scoped and avoid disturbing the legacy queue.
