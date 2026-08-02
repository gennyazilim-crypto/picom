# PICOM Feed — Production Readiness (Packaged Gate Attempt)

**Date:** 2026-08-02  
**Branch:** `feat/community-rebuild`  
**Current HEAD:** `b0f9a3a8` (`chore(desktop): restore Feed shell and App contract modules`)  
**Scope locked:** Mention / Activity Feed (not a standalone posts product)  
**Staging project:** `ufmtvqtsklqsmqxefbbs`  
**Auth gateway (staging package profile):** `https://auth.picom.gg`  
**Account center:** `https://account.picom.gg`  
**Security evidence (regression):** [`docs/audit/evidence/feed-security-hosted-2026-08-02T09-25-07-771Z`](./evidence/feed-security-hosted-2026-08-02T09-25-07-771Z/)  
**Private attachment evidence:** [`docs/audit/evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z`](./evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z/)  
**Packaged closure evidence:** [`docs/audit/evidence/feed-packaged-e2e-closure-2026-08-02`](./evidence/feed-packaged-e2e-closure-2026-08-02/)

Related: [`docs/image-thumbnail-generation.md`](../image-thumbnail-generation.md)

---

## Gate verdicts

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED RLS GATE: GO — 32/32
PICOM FEED REALTIME SECURITY GATE: GO — 21/21
PICOM FEED DEEP-LINK SECURITY GATE: GO — 8/8
PICOM FEED PRIVATE ATTACHMENT HOSTED GATE: GO — 21/21
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE STATIC GATE: GO
PICOM FEED PACKAGED PERFORMANCE: NOT_RUN
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```

**Hard blocker for packaged GO:** Clean committed worktree cannot `npm run typecheck` (94 errors at last clean tip checked). Dirty main worktree typechecks (`exit 0`) but packaging from dirty tree is forbidden. Bulk absorb of remaining dirty `src/` into history was blocked by review policy (unrelated WIP must not be dumped into Feed closure).

---

## 1. Final commit closure

### Branch / HEAD

| Item | Value |
|---|---|
| Branch | `feat/community-rebuild` |
| HEAD | `b0f9a3a8` |
| Clean worktree | `C:\Users\ACER\Desktop\picom-feed-production-wt` (detached; last synced check `ffcb7bf6`, status clean) |

### Feed product commits (private-attachment closure)

1. `178cbd3c` — `feat(feed): project private attachment storage paths`
2. `b6135953` — `fix(feed): batch sign private attachment URLs`
3. `b38dc4db` — `perf(feed): prevent ranked refresh on item merges`
4. `588d1de6` — `test(feed): cover private attachment hosted access`
5. `ed1141de` — `chore(feed): normalize storage security smoke command`
6. `77603349` — `docs(feed): record private attachment staging closure`
7. `35bab8cc` — `docs(feed): pin private attachment closure commit SHAs`
8. `2c3a9b0f` — `fix(feed): commit missing deep-link and staging package deps`

### Shared dependency commits (A — required for App/clean tree; not Feed product logic)

1. `b3c94335` — restore `src/account/**`
2. `460ebd7b` — restore live/event modules required by App
3. `13a26ec8` — sync routing/delivery types
4. `87c0bad5` — sync event + DB types / vite-env
5. `ffcb7bf6` — restore events feature modules
6. `b0f9a3a8` — restore ProfileDisplayName, companion, bookmarks, platform, auth guards, voice/App contracts

### Docs-only (within chain)

- `77603349`, `35bab8cc` (and prior media docs `274406c8`)

### Upstream Feed chain still on branch (pre-attachment)

Media/perf/pagination/Live Now etc. through `99c6c7eb`…`274406c8` remain ancestors; product scope still Mention/Activity.

### Dirty classification (main worktree ~701 short-status lines after A commits)

| Class | Examples | Action |
|---|---|---|
| **A — Feed package dependency** | Remaining dirty `src/state/useLocalMessageState.ts`, LoginScreen/Settings/MentionFeed card diffs, Icon/`live` view contracts, auth MFA session shape, DM/Live service sync still uncommitted | Still needed for clean typecheck; **not** fully committed |
| **B — Unrelated WIP** | Root dashboard modules, email-worker/auth-gateway sites, broadcaster/go-live migrations+scripts, brand/installer art, many non-Feed docs | **Not** taken into Feed closure |
| **C — Generated output** | `typecheck-out.txt`, `tsc_full_output.txt`, `smoke-out.txt`, `tmp-*.json`, media dumps | Do not commit |
| **D — Local evidence** | `docs/audit/evidence/**` (some untracked), packaged closure SUMMARY | Keep local / docs commit only when intentional |
| **E — Secret/local config** | `.env.local`, production secrets, JWT material | Never commit; worktree may copy `.env.local` gitignored for staging URL/anon only |

### Stash (not applied, not committed)

- `stash@{0}` — `wip-non-settings-before-settings-package` (brand/env/docs/updater surface)
- `stash@{1}` — `temp-before-rebase-push` (similar brand/env/docs)

### Generated / build outputs

- No fresh `package:win:dir:staging` artifact this turn.
- Prep/typecheck logs under `docs/audit/evidence/feed-packaged-e2e-*`.

---

## 2. Clean worktree

| Check | Result |
|---|---|
| Path | `../picom-feed-production-wt` |
| `git status --short` | Clean (0 lines) at checked tip |
| Stash applied | No |
| `npm ci` | PASS (earlier on worktree) |
| `npm run typecheck` | **FAIL** — 94 errors at `ffcb7bf6` (worktree not yet moved to `b0f9a3a8` for final recheck; HEAD tip still expected incomplete vs dirty green baseline) |
| `qa:smoke` / `build:web` / `electron:build` | **NOT_RUN** (blocked by typecheck) |
| Feed smoke suite in clean tree | **NOT_RUN** as full gate (blocked) |

Dirty main: `npm run typecheck` **PASS** (`exit 0`) — proves missing commits, not Feed product logic failure.

---

## 3. Fresh staging package

```
PACKAGED BUILD: NOT_RUN
environment / channel / data source: NOT_RUN
project ref target: ufmtvqtsklqsmqxefbbs (intended)
PACKAGE PATH: NOT_RUN
SHA-256: NOT_RUN
Electron / Chromium / Node / Windows / arch: NOT_RUN
```

Reason: no clean typecheck-green committed tip available without absorbing remaining **B/A** dirty `src/` mass.

---

## 4–16. Packaged E2E matrix

All of the following remain **NOT_RUN** (no fresh Picom.exe / no measured runtime):

| # | Area | Status |
|---|---|---|
| 4 | Startup / Feed entry | NOT_RUN |
| 5 | Initial Feed matrix | NOT_RUN |
| 6 | Pagination | NOT_RUN |
| 7 | Private media packaged E2E | NOT_RUN |
| 8 | Deep-link / highlight | NOT_RUN |
| 9 | Realtime two-client | NOT_RUN |
| 10 | Live Now + Companion Rail | NOT_RUN |
| 11 | Connected Voice | NOT_RUN |
| 12 | Read / save / reaction / reply | NOT_RUN |
| 13 | TR/EN + accessibility | NOT_RUN |
| 14 | Narrow window | NOT_RUN |
| 15 | Packaged performance (FPS/memory) | **NOT_RUN** → forces Production NO-GO |
| 16 | Restart persistence | NOT_RUN |
| 17 | Log classification (packaged) | NOT_RUN |

Hosted (non-packaged) private attachment + security matrices remain **GO** (see §19).

---

## 17. Logs / crashes (packaged)

```
PACKAGED LOG SWEEP: NOT_RUN
```

No claim of token/path leak absence on packaged runtime this turn.

---

## 18. Final static regression (clean committed tree)

```
CLEAN typecheck: FAIL (94 @ ffcb7bf6 evidence)
CLEAN qa:smoke / build:web / electron:build / feed smokes: NOT_RUN
```

Prior dirty-tree Feed smokes (from earlier closure turn) remain recorded PASS where run; they do **not** substitute clean packaged gate.

---

## 19. Hosted evidence references (still valid)

| Gate | Evidence | Result |
|---|---|---|
| Private attachments | `feed-private-attachment-hosted-2026-08-02T09-20-51-517Z` | 21/21 |
| Security regression | `feed-security-hosted-2026-08-02T09-25-07-771Z` | RLS 32 / RT 21 / DL 8 |
| Packaged attempt closure | `feed-packaged-e2e-closure-2026-08-02` | blocker documented |

Staging migration `20260802110000_feed_attachment_storage_path_projection.sql` **applied** to `ufmtvqtsklqsmqxefbbs`. Production **not** applied.

---

## 20. Static / build command ledger (honest)

| Command | Where | Exit | Notes |
|---|---|---|---|
| `typecheck` | dirty main | 0 | PASS |
| `typecheck` | clean worktree | 2 | FAIL 94 |
| `package:win:dir:staging` | clean | — | NOT_RUN |
| Hosted private attachment / security | staging | 0 | PASS (prior) |
| Feed smokes (dirty / prior) | main | 0 | PASS (prior); not re-claimed as clean packaged |

---

## 21. Production migration list (do not apply this turn)

1. `supabase/migrations/20260802030000_feed_ranked_audio_helper_grants.sql`
2. `supabase/migrations/20260802110000_feed_attachment_storage_path_projection.sql`

```
PICOM FEED PRODUCTION PROMOTION: PENDING
```

---

## 22. Remaining NOT_RUN (must clear for Production GO)

1. Clean committed tip with `typecheck`/`qa:smoke`/`build:web`/`electron:build` PASS
2. Fresh `package:win:dir:staging` + SHA-256 evidence dir
3. Full packaged matrix §§4–14, 16–17
4. Browser FPS + Electron memory under 25/100/500/1000 scenarios
5. Final clean static regression after package
6. Explicit production migration apply (separate promotion task)

---

## 23. What is required next (operator)

1. Curate remaining **A** dirty files into reviewed commits (or a dedicated packaging-base branch) — **without** dumping entire **B** WIP / stash.
2. Point clean worktree at that tip; confirm `git status --short` empty and `npm run typecheck` exit 0.
3. Run static suite + `npm run package:win:dir:staging`.
4. Execute real staging packaged E2E (no mock Feed data); measure FPS/memory.
5. Only then flip Packaged E2E + Production gates to GO; keep promotion PENDING until prod migrations applied.

---

## 24. Final verdict

```
PICOM FEED PRODUCT SCOPE: LOCKED — MENTION / ACTIVITY
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED RLS GATE: GO — 32/32
PICOM FEED REALTIME SECURITY GATE: GO — 21/21
PICOM FEED DEEP-LINK SECURITY GATE: GO — 8/8
PICOM FEED PRIVATE ATTACHMENT HOSTED GATE: GO — 21/21
PICOM FEED STABILITY GATE: GO
PICOM FEED MEDIA GATE: GO
PICOM FEED PERFORMANCE STATIC GATE: GO
PICOM FEED PACKAGED PERFORMANCE: NOT_RUN
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```

No Production GO without: clean committed package SHA, full packaged matrix, measured browser FPS, measured Electron memory, and no mock/leak/crash.
