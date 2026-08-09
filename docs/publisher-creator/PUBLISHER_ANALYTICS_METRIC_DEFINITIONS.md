# Publisher Analytics Metric Definitions

| Metric | Definition |
|--------|------------|
| Unique viewers | Distinct `viewer_user_id` with ≥1 non-internal session on the stream |
| Viewer sessions | Count of non-internal `publisher_viewer_sessions` rows |
| Current concurrent | Open non-stale non-internal sessions (`left_at` null, heartbeat ≤90s) |
| Peak concurrent | Max concurrent observed during stream lifecycle |
| Watch time | Sum of credited `watch_seconds` (heartbeat gaps capped at 45s) |
| Average watch time | total_watch_seconds / viewer_sessions (null if sessions=0) |
| Notification joins | Sessions with `source_allowlist = notification` |
| Followers gained | `user_follows` where followed publisher and `created_at` in stream window; exclusions applied |
| Chat messages | `live_chat_messages` type=text in stream window |
| Reactions | `live_chat_reactions` on stream messages in window |
| Moderation actions | Selected `live_chat_audit_events` types in window |
| Reconnects | Count of STREAM_RECONNECTING / STREAM_RECONNECTED events |

## Zero vs null
- 0 = measured empty (e.g. no chat)
- null = unavailable / not collected (e.g. health_sample_count when none)
- Live streams may show non-finalized metrics until finalizer runs
