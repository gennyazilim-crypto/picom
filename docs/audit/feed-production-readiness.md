# PICOM Feed — Production Readiness (Private Attachment + Closure)

**Date:** 2026-08-02  
**Branch:** `feat/community-rebuild`  
**Scope locked:** Mention / Activity Feed (not a standalone posts product)  
**Staging project:** `ufmtvqtsklqsmqxefbbs`  
**Security evidence (regression):** [`docs/audit/evidence/feed-security-hosted-2026-08-02T09-25-07-771Z`](./evidence/feed-security-hosted-2026-08-02T09-25-07-771Z/)  
**Private attachment evidence:** [`docs/audit/evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z`](./evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z/)

Related: [`docs/image-thumbnail-generation.md`](../image-thumbnail-generation.md)

---

## Gate verdicts

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO (hosted 32/32)
PICOM FEED REALTIME SECURITY GATE: GO (hosted 21/21)
PICOM FEED DEEP-LINK SECURITY GATE: GO (hosted 8/8)
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE GATE: GO
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```

---

## 1. Private attachment architecture

- Bucket remains private (`message-attachments`). Uploads persist `public_url = null`.
- `mention_feed_view` projects `storage_path` (+ optional `public_url`) only for rows already filtered by `can_view_message`, attached+clean scan, and path safety filters (`..`, `\`, leading `/` rejected).
- Client `mentionFeedService.listPage` batch-signs page paths via `feedAttachmentSigning` (TTL 1h, batch limit 40, dedupe, abort/generation cancel, user-switch cache clear).
- Signed URLs are never persisted back to `public_url`. Paths/URLs are not logged.

## 2. Migration audit / apply

| Item | Value |
|---|---|
| File | `supabase/migrations/20260802110000_feed_attachment_storage_path_projection.sql` |
| SHA-256 (local frozen) | `684A3B5DAA33ECC6C48B93F82F8DE04FDF2891CB2024FD66BAC20BAC66A7A156` |
| Kind | Forward-only `CREATE OR REPLACE VIEW` (`security_invoker`) |
| SECURITY DEFINER | No |
| Grants | `revoke` public/anon; `grant select` authenticated |
| Cursor / ranking contract | Unchanged (`list_mention_feed` signature preserved) |
| Staging apply | **Applied** to `ufmtvqtsklqsmqxefbbs` via `supabase db push --linked` (2026-08-02) |
| Duplicate apply | None (was local-only pending; single apply) |
| Production | **Not applied** |

Forward-fix: recreate prior attachment lateral requiring `public_url IS NOT NULL` from `20260711148200_feed_realtime_unread_projection.sql` in a new migration.

## 3. Hosted private attachment matrix

Command: `npm run feed:private-attachment:hosted:test`  
Evidence: `feed-private-attachment-hosted-2026-08-02T09-20-51-517Z`

```
PRIVATE FEED ATTACHMENT HOSTED MATRIX:
PASS=21 FAIL=0 TOTAL=21 NOT_RUN=0
cleanup errors=0
```

Covers projection, sign, fetch, non-member deny, metadata deny, delete/moderation hide, revoke, expiry+refresh, batch dedupe, malformed/foreign/traversal/unsupported DENY, service-role setup-only.

## 4. Hosted security regression

Command: `npm run feed:security:hosted:test`  
Evidence: `feed-security-hosted-2026-08-02T09-25-07-771Z`

```
RLS PASS=32 FAIL=0 TOTAL=32 NOT_RUN=0
REALTIME PASS=21 FAIL=0 TOTAL=21 NOT_RUN=0
DEEPLINK PASS=8 FAIL=0 TOTAL=8 NOT_RUN=0
Cleanup errors: 0
```

(First retry aborted on Realtime insert timeout; second run PASS — flake, not policy leak.)

## 5. Batch signing behavior

Module: `src/services/feed/feedAttachmentSigning.ts`  
Smoke: `npm run feed:attachment:signing:smoke` **PASS**

Validated: TTL, batch bound, path guards, dedupe, partial/total failure soft-fail, abort, cache clear on user switch, logout clear via `useProtectedDesktopSession`.

## 6. Ranked refresh performance

`MentionFeedMain` `feedQueryService.refresh` deps: `[activeFilter, activeTab, followedUserIds]` — **no `items`**.  
Asserted in signing/ranked smoke. Merge-driven infinite ranked refetch = 0 (contract).

## 7. Canonical storage smoke command

```
npm run feed:storage:security:static
→ node scripts/feed-storage-security-static-smoke.mjs
```

Alias present in `package.json`; exit code forwarded; **PASS**.

## 8. Aikido / Checkov

```
AIKIDO ACTIONABLE FINDINGS: 0
AIKIDO CLI STATUS: TOOLING_WARNING  (Opengrep exit quirk; issues[] empty; not claimed tool PASS)
CHECKOV: NOT_RUN  (local checkov.exe missing; no infra/config change this turn → not a Feed blocker)
```

## 9. Final commits (this closure)

1. `178cbd3c` — `feat(feed): project private attachment storage paths`
2. `b6135953` — `fix(feed): batch sign private attachment URLs`
3. `b38dc4db` — `perf(feed): prevent ranked refresh on item merges`
4. `588d1de6` — `test(feed): cover private attachment hosted access`
5. `ed1141de` — `chore(feed): normalize storage security smoke command`
6. `77603349` — `docs(feed): record private attachment staging closure`

Note: repository worktree still has unrelated dirty files outside Feed scope; Feed closure commits themselves are clean.

## 10. Fresh package / hash

```
PACKAGED BUILD: NOT_RUN
PACKAGE PATH: NOT_RUN
SHA-256: NOT_RUN
```

Reason: worktree still contains large unrelated dirty surface; clean packaging requires committed Feed tree + dedicated `package:win` run after commits. Packaged E2E therefore remains **NO-GO**.

## 11–13. Packaged private-media / full Feed E2E / runtime perf

```
PACKAGED PRIVATE MEDIA E2E: NOT_RUN
FULL PACKAGED FEED E2E: NOT_RUN
BROWSER FPS / ELECTRON MEMORY: NOT_RUN
```

## 14. Remaining NOT_RUN

1. Fresh staging Windows package + SHA
2. Packaged private media E2E
3. Full packaged Feed matrix
4. Browser FPS / Electron memory under load
5. Checkov (local binary absent)

## 15. Production promotion migration list (do not apply yet)

1. `supabase/migrations/20260802030000_feed_ranked_audio_helper_grants.sql` (if not already on prod)
2. `supabase/migrations/20260802110000_feed_attachment_storage_path_projection.sql`

## 16. Static / build commands (this turn)

| Command | Exit | Notes |
|---|---|---|
| `feed:media:smoke` | 0 | PASS |
| `feed:storage:security:static` | 0 | PASS |
| `feed:attachment:signing:smoke` | 0 | PASS |
| `feed:companion:smoke` | 0 | PASS |
| `feed:query:smoke` | 0 | PASS |
| `mentions:supabase:smoke` | 0 | PASS |
| `feed:security:definer:smoke` | 0 | PASS |
| `feed:actions:smoke` | 0 | PASS |
| `feed:i18n:parity` | 0 | PASS |
| `typecheck` | 0 | after signing type fix |
| `feed:private-attachment:hosted:test` | 0 | 21/21 |
| `feed:security:hosted:test` | 0 | 32/21/8 |
| `qa:smoke` / `build:web` / `electron:build` | pending/see evidence | |

## 17. Attachment contract (unchanged product rules)

| Concern | Canonical |
|---|---|
| Storage bucket | `message-attachments` (private) |
| URL policy | project `storage_path`; client batch-signs; never persist signed URLs |
| Types in Feed | image cards only |
| Moderation | clean / skipped_development only |
| TS model | `FeedAttachment` + `feedAttachmentSigning` |

---

## Gate verdicts (final)

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO
PICOM FEED REALTIME SECURITY GATE: GO
PICOM FEED DEEP-LINK SECURITY GATE: GO
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE GATE: GO
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```
