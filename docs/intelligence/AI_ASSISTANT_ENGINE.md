# Picom Intelligence Engine — AI Assistant Engine

**Task 05 · assistant for daily summaries, missed activity, community recap, smart
reminders, and the notification digest.** **Never trains on, stores, or sends private
message/DM content, audio, or video.** Operates on **activity metadata** the user already
has access to (unread counts, mentions, events, notification inbox).

## Consent & data boundary
- Gated by the **`aiAssistant`** opt-in (default OFF). Off ⇒ no summaries/digests are
  generated; standard notifications still work.
- **Inputs are metadata, not content**: unread counts per channel/community, mention
  counts, event schedules, notification-inbox items (already-redacted), presence of new
  activity. The assistant may show a **user-owned** snippet the user can already read
  (e.g., "3 unread in #general") but **does not** send message bodies to any model for
  training, nor build a content profile.
- **No training on private data**: no message/DM/thread content, audio, video, or search
  text is used to train or fine-tune any model. If an LLM is used for phrasing, it receives
  only minimized, non-identifying counts/labels, and outputs are ephemeral.

## Features
| Feature | Input (metadata only) | Output |
|---|---|---|
| Daily summary | unread counts, mentions, new followers, events today | "Since yesterday: 2 mentions, 5 unread communities, 1 event at 18:00" |
| Missed activity | unread/mention deltas since last active | grouped, prioritized (mentions first) |
| Community recap | per-community activity counts, top active channels (by count) | "#dev had 40 messages, 3 mentions of you" — counts, not content |
| Smart reminders | scheduled events (`eventReminderService`), radio schedules, unanswered mentions | timed nudges, respecting Quiet Hours/DND |
| Notification digest | batched routed notifications (Task 02) | one grouped summary instead of many toasts |

## Architecture
1. **Aggregator** (on-device): reads consented metadata (read-states, mention feed, event
   service, notification inbox) and computes counts/deltas. No content leaves this layer.
2. **Prioritizer**: ranks by importance (direct mentions > replies > community activity),
   personal active-hours (Task 03), and DND/Quiet-Hours rules — reuses
   `notificationService` routing so muted/DND scopes are honored.
3. **Renderer**: templates the summary locally. Phrasing is deterministic templates by
   default; an optional LLM pass (only if separately enabled) receives **only**
   counts/labels/times, never bodies, and its output is not persisted or used for training.
4. **Scheduler**: delivers the daily summary at the user's typical active hour; digests
   batch on a cadence; reminders fire at event-relative offsets.

## Privacy guarantees
- Content-blind: a review must reject any assistant path reading message/DM/thread bodies,
  audio, video, or search text into a model or store.
- Reminders/summaries respect **DND**, **Quiet Hours**, and per-scope mutes (already in
  `decideNotificationRoute`).
- All assistant state is inspectable and erasable in the **Privacy Center**
  ([PRIVACY_CENTER.md](./PRIVACY_CENTER.md), Task 08); retention per
  [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09).
- Emergency kill switch (`emergencyKillSwitchService`) can disable the assistant remotely.

## Consumers/inputs
- Timing & relevance from [PERSONALIZATION_ENGINE.md](./PERSONALIZATION_ENGINE.md) (Task 03).
- Surfaced recommendations from [RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md) (Task 04).
