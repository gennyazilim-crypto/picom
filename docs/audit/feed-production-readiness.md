# PICOM Feed — Production Readiness (Stability Package)

**Date:** 2026-08-02  
**Branch:** `feat/community-rebuild`  
**Scope locked:** Mention / Activity Feed (not a standalone posts product)  
**Staging project:** `ufmtvqtsklqsmqxefbbs`  
**Prior security evidence:** [`docs/audit/evidence/feed-security-hosted-2026-08-02T05-21-08-536Z`](./evidence/feed-security-hosted-2026-08-02T05-21-08-536Z/)  
**Production promotion migration (list only; not applied this turn):** `supabase/migrations/20260802030000_feed_ranked_audio_helper_grants.sql`

Related audit: [`docs/audit/feed-current-state-audit.md`](./feed-current-state-audit.md)

---

## Gate verdicts

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO — hosted staging 32/32 (prior evidence; not re-run)
PICOM FEED REALTIME SECURITY GATE: GO — hosted two-client 21/21 (prior evidence; not re-run)
PICOM FEED DEEP-LINK SECURITY GATE: GO — hosted 8/8 (prior evidence; not re-run)
PICOM FEED STABILITY GATE: GO
PICOM FEED PRODUCTION GATE: NO-GO
```

Production remains NO-GO: thumbnail/performance hardening and fresh packaged Feed E2E stay in later packages. Hosted security matrix was **not** re-run this turn (no RLS/Realtime/deep-link contract or migration surface change).

---

## 1. Stale smoke root causes

| Test | File | Failing assertion (pre-fix) | Old expected | Canonical now | Stale fixture | Product bug? | Contract bug? | Fix |
|---|---|---|---|---|---|---|---|---|
| `feed:companion:smoke` | `scripts/feed-companion-rail-smoke-test.mjs` | Stories header / mock popular / mock events on Feed | Stories strip + demo companion | Live Now band + real friends/events/voice | `mockUpcomingEvents`, `mockPopularUserIds` | No | Yes | Rewrote smoke; removed Feed stories + right-panel mock populars |
| `feed:query:smoke` | `scripts/unified-feed-query-smoke.mjs` | Allowed `isMock` / demo fallback | Mock-tolerant query path | Fail-closed ranked RPC | `isMock` branch expectation | No | Yes | Forbid `isMock`; require fail-closed codes |
| `mentions:supabase:smoke` | `scripts/mention-feed-supabase-smoke.mjs` | Allowed mock fallback | Mock mention list | `list_mention_feed` only | `isMock` / demo data | No | Yes | Forbid `isMock`; require fail-closed codes |

Result after fix: all three **PASS**.

---

## 2. Production mock cleanup

- Removed App Feed imports of `mockFollows` / `mockFriends`; initial friend/follow state is empty until Supabase loads.
- Mention / ranked query services remain fail-closed (no demo cards on Supabase error).
- `npm run feed:mock:bundle:scan` **PASS** — production Feed paths must not import `mockMentions` / `mockPopularUserIds` / `mockUpcomingEvents` / `mockFriends` / `mockFollows`.
- Dev fixtures remain under `src/data/*` behind `import.meta.env.PROD ? []` and are not used as Feed production fallback.

---

## 3. Stories cleanup

Removed Feed half-integration:

- Deleted unused `FollowedPeopleStoriesHeader.tsx`, `StoryViewerModal.tsx`, `StoryViewerModal.css`
- Removed App story state/handlers (`storyItems`, `markStorySeen`, `openStoryInChannel`)
- Stripped Feed CSS for `.followed-stories-*`, `.story-card*`, legacy `.live-broadcasts-*`
- Updated stale stories/tabs/bundle/accessibility/overlay smokes to the Live Now contract

Shared `storyService` / `mockStories` left in place for non-Feed callers; Feed no longer mounts them.

---

## 4. Live Now Preview

- New `FeedLiveNowPreviewBand` uses `liveScreenShareService.listVisibleLiveShares` + `subscribeToVisibleLiveShares`
- Cards: avatar, display name, verified, title, category, viewers, live badge, thumbnail, community, `started_at`
- Action opens canonical Live Watch (`setLiveWatchSessionId` + `syncFromApp("live", { liveSessionId })`)
- States: loading / empty / error+retry / single / multi; narrow layout collapses nav at `1380px`
- Realtime: subscribe on mount, unsubscribe on unmount; dedupe by session id; no second Feed realtime channel

---

## 5. Feed item contract

- `src/services/feed/feedActivityMapper.ts` maps mention + ranked unified rows → `FeedActivityItem`
- Dedupes by `messageId` (then activity/tie-breaker)
- Malformed rows map to `null` and are dropped
- `MentionFeedMain` routes items through mapper before list render

---

## 6. Cursor pagination

- Uses existing `list_mention_feed` cursor (`created_at` + `message_id`); **no offset**
- App: `mentionFeedCursor`, `hasMore`, `loadingMore`, `loadMoreMentionFeed`, `retryMentionFeed`, `mentionFeedLoadSeq` stale cancellation
- Cache: `mergePage` for append; Load More accessible button (`feed.loadMore` / “Daha fazla yükle”)
- End-of-feed copy via `feed.end`

---

## 7. Realtime / pagination behavior

- DELETE still removes by `sourceId` without rewriting cursor
- Change events: `mergeRealtimeHead` patches existing cards; new ids bump `pendingNewMentionCount` (no silent prepend / scroll jump)
- “New activities” control reveals via controlled refresh (`retryMentionFeed`) and resets pending count
- Reconnect: full first-page replace + cursor reset
- Offline→online uses reconnect path; subscription cleaned on unmount

---

## 8. Loading / error states

Distinct UI: initial loading, loading more, empty, unread-empty, offline, error+retry, end of feed, new activities. Supabase raw errors are not shown; i18n keys under `feed.*`.

---

## 9. Replies / reactions regression

- No Feed comment model added
- Reply preview / count remain message-thread fields on mention items
- Reactions remain channel message emoji aggregates; Like/Fire continue as emoji presets via existing toggles
- Optimistic reaction rollback path in App unchanged

---

## 10. Companion Rail regression

- `FeedCompanionRail` still mounts real friends presence, upcoming events, Connected Voice
- Duplicate `MentionRightPanel` removed from Feed shell
- No mock friend/event imports on Feed
- Collapses at `max-width: 1380px`
- `feed:companion:smoke` **PASS**

---

## 11. i18n / accessibility

- TR/EN keys for loading, empty, retry, load more, end, new activities, replies, reactions, saved/read, Live Now, companion labels, inaccessible
- `npm run feed:i18n:parity` **PASS**
- Load More + New activities are keyboard buttons with focus-visible styles; Live Now cards expose aria labels; reduced-motion honored on Live Now scroll

---

## 12. Static / build results

| Command | Exit | Result | Notes | Timestamp (local) |
|---|---|---|---|---|
| `npm run feed:companion:smoke` | 0 | PASS | | 2026-08-02T10:25:28+02 |
| `npm run feed:query:smoke` | 0 | PASS | | 2026-08-02T10:25:28+02 |
| `npm run mentions:supabase:smoke` | 0 | PASS | | 2026-08-02T10:25:29+02 |
| `npm run feed:security:definer:smoke` | 0 | PASS | | 2026-08-02T10:25:30+02 |
| `npm run feed:actions:smoke` | 0 | PASS | | 2026-08-02T10:25:30+02 |
| `npm run feed:realtime:cache:smoke` | 0 | PASS | | 2026-08-02T10:27:xx+02 |
| `npm run feed:mapper:smoke` | 0 | PASS | | after mapper fix |
| `npm run feed:pagination:smoke` | 0 | PASS | | 2026-08-02T10:25:31+02 |
| `npm run feed:live-now:smoke` | 0 | PASS | | 2026-08-02T10:25:32+02 |
| `npm run feed:mock:bundle:scan` | 0 | PASS | | after App mock import removal |
| `npm run feed:i18n:parity` | 0 | PASS | | 2026-08-02T10:25:32+02 |
| `npm run feed:tabs-stories:smoke` | 0 | PASS | rewritten for Live Now | 2026-08-02 |
| `npm run typecheck` | 0 | PASS | | 2026-08-02 |
| `npm run qa:smoke` | 0 | PASS | fixed Live Now `@media` 1380px | 2026-08-02 |
| `npm run build:web` | 0 | PASS | Vite/PWA warnings only (chunk size / ineffective dynamic import) | 2026-08-02T10:30+02 |
| `npm run electron:build` | 0 | PASS | | 2026-08-02T10:30+02 |
| `npm run feed:security:hosted:test` | — | NOT_RUN | no hosted security surface change | — |

npm `devdir` config warnings are environment noise, not test failures.

---

## 13. Commits

Applied on `feat/community-rebuild`:

1. `0fbb8b74` — `test(feed): repair stale mention activity smoke contracts`
2. `a00fd7a7` — `refactor(feed): remove incomplete story integration`
3. `a3913c88` — `feat(feed): add live now preview band`
4. `1c7deddd` — `feat(feed): add cursor pagination and load-more`
5. `fix(feed): stabilize realtime pagination updates` (HEAD)

Secrets, local evidence dumps, and operator markers were not committed. Unrelated dirty worktree files outside this Feed stability package remain unstaged.

---

## 14. Remaining blockers (Production NO-GO)

1. Thumbnail / media performance pass for Feed cards
2. Fresh packaged Feed E2E on hosted staging (desktop + web package)
3. Optional: wire Companion Rail section titles fully through `feed.companion.*` keys (rail still functional with real data)
4. Production apply of `20260802030000_feed_ranked_audio_helper_grants.sql` remains a separate promotion step

---

## 15. Gate verdicts (final)

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO
PICOM FEED REALTIME SECURITY GATE: GO
PICOM FEED DEEP-LINK SECURITY GATE: GO
PICOM FEED STABILITY GATE: GO
PICOM FEED PRODUCTION GATE: NO-GO
```
