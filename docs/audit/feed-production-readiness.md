# PICOM Feed — Production Readiness (Media + Performance Package)

**Date:** 2026-08-02  
**Branch:** `feat/community-rebuild`  
**Scope locked:** Mention / Activity Feed (not a standalone posts product)  
**Staging project:** `ufmtvqtsklqsmqxefbbs`  
**Prior security evidence:** [`docs/audit/evidence/feed-security-hosted-2026-08-02T05-21-08-536Z`](./evidence/feed-security-hosted-2026-08-02T05-21-08-536Z/)  
**Production promotion migration (list only; not applied this turn):** `supabase/migrations/20260802030000_feed_ranked_audio_helper_grants.sql`

Related: [`docs/image-thumbnail-generation.md`](../image-thumbnail-generation.md)

---

## Gate verdicts

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO (prior hosted 32/32; not re-run)
PICOM FEED REALTIME SECURITY GATE: GO (prior hosted 21/21; not re-run)
PICOM FEED DEEP-LINK SECURITY GATE: GO (prior hosted 8/8; not re-run)
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE GATE: GO
PICOM FEED PRODUCTION GATE: NO-GO
```

Production remains NO-GO until fresh packaged Feed E2E. Hosted Feed security matrix **NOT_RUN** this turn (no Storage/RLS/RPC migration change). Hosted Storage deny matrix also **NOT_RUN** — static policy/upload contract smoke only.

---

## 1. Attachment contract

| Concern | Canonical |
|---|---|
| Table / view | `public.message_attachments` (+ feed RPC JSON `attachments` on `list_mention_feed` / `mention_feed_view`) |
| Message relation | `message_id` → channel messages; Feed reads via permission-filtered RPC |
| Storage bucket | `message-attachments` (`MESSAGE_ATTACHMENTS_BUCKET`) |
| Object path | signed upload path from `create-message-attachment-upload` Edge Function |
| URL policy | metadata `public_url` when available; upload creates pending row without inventing thumbnail URLs |
| Types in Feed | **image only** in Feed projection today |
| MIME / size / WxH | `mime_type`, `size_bytes`, `width`, `height` on metadata |
| Duration / video | not projected in Feed image cards |
| Thumbnail field | `thumbnail_url` nullable; null = native original preview |
| Moderation | `scan_status` (`clean` / `skipped_development` render; quarantine blocks) |
| Access control | message visibility + storage policies; client does not bypass |
| TS model | `FeedAttachment` in `src/services/feed/feedAttachmentModel.ts` |
| Mapper | `mapRpcAttachments` → UI `Attachment` via `feedAttachmentToUiAttachment` |

Malformed rows drop to `null` and never reach the renderer.

---

## 2. Thumbnail implementation (Approach B)

- Removed `EDGE_FUNCTION_PLACEHOLDER` / fake thumbnail URL generation.
- `createNativePreviewMetadata()` always returns `thumbnailUrl: null`, `generated: false`.
- UI uses `resolveNativeImagePreviewUrl()` → real thumb if present, else original.
- Docs: `docs/image-thumbnail-generation.md`
- Smoke: `npm run thumbnails:smoke` **PASS**

---

## 3. Image policy

- Allowlist: PNG/JPEG/WEBP/GIF (`fileService`)
- Magic-byte validation on upload
- Max size 10 MB
- SVG denied (not in allowlist)
- Lazy + `decoding=async` on Feed grid
- Quarantine recheck in viewer
- Broken image fallback state
- Orientation/EXIF strip: **not** implemented client-side (report: deferred to server processor if Approach A lands)
- Decompression bomb: size cap only (report honestly)

---

## 4. Video policy

- Feed image grid does **not** mount video elements.
- No Feed video transcoding.
- Unsupported non-image kinds stay out of the image grid (`partitionFeedAttachments`).
- Autoplay N/A for Feed cards.

---

## 5. Media grid / viewer

- Layouts 1 / 2 / 3 / 4 / +N overflow tile
- Max grid height bounded (~280–320px)
- Keyboard open (Enter/Space)
- Gallery viewer: next/previous, Escape via focus trap, focus trap, broken/quarantine states
- Audio/file not forced into image grid

---

## 6. Storage security

- Static smoke: `scripts/feed-storage-security-static-smoke.mjs` **PASS**
- Hosted allow/deny matrix: **NOT_RUN** (no policy change this turn)
- Uploads remain Edge-signed; foreign path traversal blocked in thumbnail path helper

---

## 7. URL / cache lifecycle

- No fabricated thumbnail URLs
- Object URL download path always `revokeObjectURL`
- Preview uses original URL after access check
- Avatar cache (`profileMediaStore`) remains separate from attachment URLs

---

## 8. Query / N+1

- Mention page still one `list_mention_feed` RPC (+ following list on boot)
- Attachments/reactions/reply previews arrive in RPC JSON — no per-card attachment metadata queries
- Realtime **change** events debounced (180ms) and patch via `mergeRealtimeHead` (no full unlimited refetch)
- Reconnect: single controlled refresh
- Live Now band keeps its own subscription (separate product surface; unsubscribes on unmount)

---

## 9. Render performance

- `MentionFeedCard` memoized
- Stable keys `text-${id}` / `audio-${id}`
- Synthetic Node bench (mapper + windowing): see §15
- Browser FPS / Electron CPU: **NOT_RUN** (no packaged harness this turn)

---

## 10. DOM bounding

- Approach B: `sliceFeedWindow` caps mounted entries (default 120) in `UnifiedFeedList`
- Deep-link `ensureId` can force a target into the window
- Unbounded full-list mount prevented for large synthetic sets

---

## 11. Realtime performance

- Debounced change refresh
- In-flight refresh coalescing retained
- DELETE removes source without cursor rewrite
- Pending “new activities” for newly seen head ids

---

## 12. Companion Rail performance

- No change to subscription ownership model this turn; companion smoke still **PASS**
- Live Now band remains separate from Companion Voice rooms (no Stories duplicate)

---

## 13. Accessibility

- Media count group label
- Open / overflow aria labels (TR/EN)
- Viewer close / next / previous labels
- Focus trap + Escape
- Reduced-motion respected on Live Now (prior) and card hover transitions

---

## 14. Tests (this turn)

| Command | Exit | Result |
|---|---|---|
| `npm run feed:media:smoke` | 0 | PASS |
| `npm run feed:perf:synthetic` | 0 | PASS |
| `npm run thumbnails:smoke` | 0 | PASS |
| `node scripts/feed-storage-security-static-smoke.mjs` | 0 | PASS |
| `feed:companion/query/mentions/security:definer/actions/pagination/realtime/i18n` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm run qa:smoke` | 0 | PASS |
| `npm run build:web` | 0 | PASS |
| `npm run electron:build` | 0 | PASS |
| `npm run feed:security:hosted:test` | — | NOT_RUN |

---

## 15. Performance evidence

Method: Node synthetic mapper+windowing microbench on developer machine (Windows).  
**Not** browser scroll FPS.

Acceptance checked in smoke:

- duplicate Feed ids: 0
- mounted cap: ≤120 at 500/1000 items
- placeholder thumbnail production path: 0
- 1000-item map+window budget: &lt;250ms assert

Browser FPS / detached DOM / Live media element counts: **NOT_RUN**.

---

## 16. Commits

1. `99c6c7eb` — `refactor(feed): canonicalize attachment media contract`
2. `28f77e9b` — `fix(feed): replace placeholder thumbnail handling`
3. `3b35a7c4` — `fix(feed): harden feed media grid and viewer lifecycle`
4. `3ffb09b1` — `perf(feed): remove card query and rendering bottlenecks`
5. `0a5b99e6` — `perf(feed): bound long feed rendering and realtime refreshes`
6. `c800092c` — `test(feed): add media and performance production coverage`

---

## 17. Remaining blockers (Production NO-GO)

1. Fresh packaged Feed E2E (desktop + web package)
2. Hosted Storage allow/deny matrix if/when policies change
3. Optional Approach A server thumbnail worker
4. Browser FPS / memory evidence under Electron

---

## 18. Gate verdicts (final)

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO
PICOM FEED REALTIME SECURITY GATE: GO
PICOM FEED DEEP-LINK SECURITY GATE: GO
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE GATE: GO
PICOM FEED PRODUCTION GATE: NO-GO
```
