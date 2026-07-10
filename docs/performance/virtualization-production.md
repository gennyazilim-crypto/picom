# Picom large-data performance and virtualization production plan

## Current decision

Picom does not add a virtualization dependency in this task. The desktop UI includes variable-height messages, replies, reactions, polls, image grids, edited/deleted/failed states, unread divider, typing indicator, message highlight, and auto-scroll. Replacing the current list with a naive fixed-row virtualizer would risk scroll jumps, inaccessible focus, broken image sizing, and lost context.

Small safe hot-path fixes were applied:

- `MessageList` builds memoized member, role, message, and blocked-user lookup structures instead of repeated per-row linear `find/includes` calls.
- Mention Feed memoizes quick-filter output and story ID derivation.
- Existing MemberSidebar deferred search, memoized grouping/role maps, and memoized member rows remain.
- Existing profile media/attachments use lazy loading; attachment previews reserve known width/height when available.
- Existing Supabase Realtime hook removes channels on cleanup; presence/typing paths already throttle/debounce.

No visual dimensions, ordering, scroll container, responsive/mobile behavior, or interaction changed.

## Baseline and measurement first

Virtualization should be enabled only after recording a packaged Electron baseline on representative mid-range Windows, Linux, and macOS hardware.

Datasets:

| Surface | Baseline set | Stress set | Virtualization trigger candidate |
|---|---:|---:|---:|
| Messages in active channel | 200 | 5,000 / 20,000 pagination fixture | Sustained >16ms frames or >150ms channel render at 500 visible-loaded rows |
| Mention Feed cards | 100 | 1,000 | >150ms filter/tab switch or long-task bursts |
| Members | 500 | 2,000 / 10,000 | >100ms search/group update or scrolling below 55 FPS |
| Profile media | 100 metadata / 30 visible thumbnails | 500 | decoded image memory or layout > budget |
| Stories | 12 current | 100 | horizontal scroll/input jank or excessive image decode |
| Realtime burst | 100 events/s synthetic bounded | 1,000 queued low-priority events | input/frame loss, duplicate state, unbounded queue/memory |

Capture:

- first render and channel/tab switch durations
- React commit durations and changed component counts
- long tasks and frame rate during scroll
- JS heap, DOM node count, decoded image memory, object URLs
- realtime queue length/dedupe/batch duration
- network rows/bytes per page
- focus and scroll position before/after prepend/update

Use packaged production builds; Vite dev/HMR timings are diagnostic only.

## MessageList production virtualization

### Current risks

- All loaded messages create DOM nodes.
- Variable height changes after image decode, reply/poll/reaction updates, editing, localization, and text wrapping.
- Current new-message effect scrolls to bottom; it does not distinguish a user reading history.
- Highlight lookup scans rendered DOM, which cannot find an unmounted virtual row.
- Unread divider and typing row are synthetic rows mixed with messages.

### Required row model

Normalize the rendered stream before virtualization:

```ts
type MessageListRow =
  | { type: "message"; key: string; messageId: string }
  | { type: "unread"; key: string }
  | { type: "typing"; key: string };
```

The source remains normalized message IDs by channel. Derive author/role/reply through maps/selectors, as the current safe optimization begins to do.

### Variable-height requirements

- Use a measured variable-size virtualizer only after a library/security/bundle/license review.
- Stable row key is message ID, never array index.
- Estimate from message kind/attachment dimensions; update measurement through `ResizeObserver` with batching.
- Reserve attachment dimensions from metadata to avoid layout shift.
- Cache measurements per message ID and invalidate only when body/edit/delete/reactions/poll/attachment width changes.
- Editing row remains mounted/focused; do not recycle focused textarea into another message.
- Context menu/profile/image overlays use entity data, not a required mounted source row.

### Scroll behavior

- Track whether user is within a bottom threshold before append.
- Auto-scroll only for own send or when already near bottom; otherwise increment a New messages control.
- Preserve anchor message ID and pixel offset when older pages prepend.
- Scroll-to-message fetches the containing cursor/page, mounts target, measures, centers, then highlights.
- Unread divider remains at its logical sequence boundary.
- Image dimension changes compensate scroll anchor where practical.

### Accessibility

- Do not claim `aria-setsize` for unknown/unbounded history.
- Keyboard focus must not disappear when a row leaves the overscan window; pin active/focused row.
- Screen reader access needs a sensible overscan/reading strategy and live announcements separate from virtual DOM insertion.
- Reduced motion disables smooth/animated scroll.

### Pagination boundary

Virtualization does not replace server pagination. Use cursor/sequence-based pages, bounded in-memory windows, dedupe by message/event/clientMessage ID, and explicit older/newer loading state. Do not fetch thousands of message bodies only to hide DOM rows.

## Mention Feed performance

- Keep feed/following/quick-filter derivations memoized and avoid mutating prop arrays.
- Normalize authors/communities/channels/commenters into ID maps once per dataset, not per card.
- Memoize a card only after callbacks and derived arrays are stable; shallow `memo` with freshly created props gives false confidence.
- Paginate with cursor/ranking snapshot to avoid duplicate/reordered cards.
- Virtualize/window only when card count and profiling justify it; variable attachment/comment previews need measurement.
- Keep Open in channel/profile/image behavior entity-driven so unmounted cards are safe.
- Defer low-priority counts/reaction summaries under bursts but apply current-user actions immediately.

## MemberSidebar performance

Current strengths:

- `useDeferredValue` keeps typing responsive.
- Filtering/grouping and role map are memoized.
- `MemberRow` is memoized and has stable member ID keys.

Production path:

1. Flatten groups into fixed-height `groupHeader/member` rows.
2. Lock row/header heights and use a fixed-size virtualizer when >500/2,000 profiling triggers it.
3. Maintain `memberById`, `roleById`, and group ID arrays; update only changed member/presence entities.
4. Batch presence deltas per animation frame/short window rather than replacing every member object.
5. Keep selected/profile/context target by member ID outside row DOM lifetime.
6. Preserve keyboard order, group labels/counts, and screen reader access.

Search should remain deferred locally. Supabase production for very large communities should use server cursor/search rather than downloading every member.

## Profile media and images

- Profile media and attachments already use `loading="lazy"`; retain `decoding="async"` where preview priority permits.
- Full ImagePreview is intentionally eager after user action.
- Composer-selected previews are visible immediately and should not be lazy; revoke object URLs on remove/unmount.
- Supply width/height or aspect ratio for avatar, attachment, story, profile, and thumbnail media.
- Use thumbnails in grids and full object only in preview.
- Bound concurrent image decode/network requests and cache entries; private media cache must respect access loss.
- Avoid duplicate URL resolution/lookup inside every MessageItem render.
- Add `content-visibility` only after accessibility, focus, and measurement tests; do not combine blindly with virtualization.

## Story row

- Current fixed compact cards and horizontal overflow are suitable for small followed-story sets.
- Keep card keys as story IDs and artwork CSS/bounded.
- For large sets, render a bounded recent window/page and load more on horizontal threshold; do not create hundreds of offscreen artwork layers.
- Memoize author lookup maps and active index for large sets.
- Keep previous/next deterministic and accessible even when pages load.
- Opening/seen state updates only the affected entity.

## Search and filtering

- Member search already uses deferred values.
- Remote/advanced search should debounce 250-350ms, cancel previous request with AbortController, require minimum useful query, cap limit, and ignore stale responses.
- Local filter/search should normalize once per entity update, not on every keystroke for every field at large scale.
- Never debounce keyboard focus/selection state or hide immediate typed input.
- Search results remain RLS/access filtered and cursor paginated.

## Realtime event bursts

- Dedupe event IDs/clientMessage IDs before React state work.
- Reject older message updates/tombstone resurrection using server timestamps/sequence.
- Batch low-priority presence/typing/reaction updates in a short queue or animation frame.
- Apply message inserts/deletes and current-user confirmations promptly while preserving per-channel order.
- Bound recently-seen event ID cache and pending queue by size/time; overflow triggers a refetch/resync, not unbounded memory.
- Drop stale typing/presence safely; never drop committed message state silently.
- Keep one subscription per active scope and remove it on channel/community/unmount.
- Measure UI commit time and event lag separately from provider delivery latency.

## Cleanup and memory

Required checks during a 30-60 minute soak:

- no duplicate Realtime subscriptions after 100 channel switches
- timers/requestAnimationFrame/ResizeObserver/listeners canceled on unmount
- composer/file/image object URLs revoked
- image cache bounded and invalidated on profile/icon/access change
- virtual measurement cache drops messages removed from the in-memory window
- no retained modal/context menu entity graph after close
- no repeated scroll handlers without passive/throttled behavior

## Rollout plan

1. Add deterministic large mock fixtures behind development/test tooling, not normal startup.
2. Capture baseline against performance budget.
3. Normalize selectors/data without visual changes.
4. Implement one surface at a time, starting MemberSidebar fixed rows before variable-height messages.
5. Add visual, keyboard, screen reader, scroll-anchor, prepend, image, edit, context-menu, and realtime tests.
6. Internal ring and long-running soak on Windows/Linux/macOS.
7. Enable threshold/flagged rollout; retain non-virtual fallback for emergency rollback until proven.
8. Compare memory/frame/interaction telemetry without content/private data.

## Release blockers

- Visible order changes or duplicate/missing messages.
- Scroll jumps on append/prepend/image load.
- Composer loses pinned position or focused editor unmounts.
- Unread/new-message/highlight behavior fails.
- Keyboard/screen-reader cannot reach visible items.
- Context/profile/image overlays break when rows unmount.
- Presence/realtime bursts freeze input or grow memory unbounded.
- Private images remain cached after access loss.
- Small channels regress in appearance or behavior.

## Current result

Large-data architecture is documented and safe lookup/memoization improvements are active. Full runtime virtualization remains intentionally deferred until packaged profiling proves need and its variable-height/accessibility/scroll behavior is implemented with dedicated tests.
