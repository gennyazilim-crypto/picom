# Picom Intelligence Engine — Personalization Engine

**Task 03 · personalization from consented behavior only.** Grounds on Task 01/02 (consent
tiers, typed events) and shipped services (`settingsService`, `localizationService`, the
emoji recents, `analyticsService` feature counts). **Private messages, DM/thread content,
audio, and video are never used.**

## Consent & scope
- Gated by the **`personalization`** opt-in (default OFF; see
  [DATA_COLLECTION_POLICY.md](./DATA_COLLECTION_POLICY.md) §3). Off ⇒ the app uses only
  explicit settings (theme/language the user picked); no behavioral personalization.
- **On-device first**: personalization signals are computed and stored on the device
  (`localStorage`), pseudonymous, never joined to message content or a social graph.
- Withdrawing consent purges the personalization profile immediately.

## Signals (all consented, content-free)

| Signal | Source | Representation | Notes |
|---|---|---|---|
| Language | explicit setting / `navigator.language` | locale code | already user-chosen; no inference from message text |
| Theme | `settingsService` `themeMode` | light/dark/system | explicit preference |
| Favorite communities | community-open counts (device-only) | decayed visit score per community id (local) | ids stay on device; not sent as analytics |
| Favorite emojis | emoji-picker recents/usage | top-N emoji ids (local) | reaction/emoji ids only, never message text |
| Active hours | `session_heartbeat` duration buckets | 24-bucket histogram | buckets, not exact timestamps |
| Feature usage | `feature_usage_count_only` | per-feature counts | already count-only |
| Content-type affinity | feed `cardType` opened (buckets) | weights per card type | type only (community/radio/podcast), never content |

Explicitly **excluded**: message/DM content, who-you-talk-to graph, mic/camera, search
query text, precise timestamps, location.

## Profile & model

**Profile** (device-local, versioned):
```ts
type PersonalizationProfile = {
  version: 1;
  locale: string;
  themeMode: "light" | "dark" | "system";
  communityAffinity: Record<string /*id*/, number /*decayed score*/>;
  favoriteEmojis: string[];
  activeHours: number[];        // length 24, normalized
  featureWeights: Record<string, number>;
  updatedAt: string;
};
```

**Model** — deliberately simple, explainable, on-device:
1. **Recency-decayed counts**: each signal increments a score; scores decay
   (`score *= 0.98` daily) so preferences track the recent ~weeks, not all history.
2. **Normalization**: affinities/weights normalized to `[0,1]` for comparability.
3. **Derived preferences** consumed by other engines:
   - Preferred content types & active hours → Recommendations (Task 04) ordering and the
     AI digest (Task 05) timing.
   - Favorite communities/emojis → surface ordering, quick-reactions.
   - Locale/theme → UI (already applied).
4. **Cold start**: no profile ⇒ neutral weights; the app is fully usable and unbiased.

No training on content; no cross-user profiling. The model is a weighted average, auditable
by inspecting the local profile in the Privacy Center.

## Privacy guarantees
- Personalization reads **only** the signals above; a review must reject any path touching
  content, DM participants, or raw identifiers leaving the device.
- Server involvement (optional, future) is **aggregate & pseudonymous** only (e.g., popular
  emoji sets), never per-user content, and still gated by the same consent.
- Fully inspectable/erasable via the **Privacy Center** ([PRIVACY_CENTER.md](./PRIVACY_CENTER.md), Task 08).
- Retention per [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09): profile is device-local
  and cleared on consent withdrawal or sign-out.

## Consumers
- [RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md) (Task 04) — ranking features.
- [AI_ASSISTANT_ENGINE.md](./AI_ASSISTANT_ENGINE.md) (Task 05) — digest timing/relevance.
