# PICOM Feed — Production Readiness (Clean Dependency Closure)

**Date:** 2026-08-02  
**Branch:** `feat/community-rebuild`  
**Final clean tip / package commit:** `6b0de2b2`  
**Docs tip:** (this report commit)  
**Scope locked:** Mention / Activity Feed  
**Staging project:** `ufmtvqtsklqsmqxefbbs`  
**Hosted security evidence:** [`docs/audit/evidence/feed-security-hosted-2026-08-02T09-25-07-771Z`](./evidence/feed-security-hosted-2026-08-02T09-25-07-771Z/)  
**Hosted private attachment evidence:** [`docs/audit/evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z`](./evidence/feed-private-attachment-hosted-2026-08-02T09-20-51-517Z/)  
**Dependency closure evidence:** [`docs/audit/evidence/feed-packaged-e2e-closure-2026-08-02`](./evidence/feed-packaged-e2e-closure-2026-08-02/)  
**Fresh package evidence:** [`docs/audit/evidence/feed-packaged-e2e-2026-08-02T12-46-15`](./evidence/feed-packaged-e2e-2026-08-02T12-46-15/)

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
PICOM FEED CLEAN DEPENDENCY CLOSURE: GO
PICOM FEED PACKAGED PERFORMANCE: NOT_RUN
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```

**Why Packaged E2E remains NO-GO:** Fresh staging package + static env preflight succeeded, but the full interactive packaged matrix (pagination/private media/realtime two-client/FPS/memory/restart) was **not** executed this turn. Without measured browser FPS and Electron memory, Production cannot be GO.

---

## 1. Typecheck root-cause clusters (clean tip before closure)

Baseline at `fa35e7b8` clean worktree: **50 errors** (earlier `ffcb7bf6` snapshot was 94; intervening shared deps already reduced the set).

| Cluster | Approx errors | Root cause | Owning feature | Feed required? |
|---|---|---|---|---|
| `sendAttempt` missing on local message inputs | 6 | Outdated `useLocalMessageState` contracts vs App | messages | A (shell) |
| Profile `username` / `verification` missing | ~8 | `ProfileMediaRecord` / resolver lag | profile / Feed cards | A |
| Missing `ensureCommunityMemberRoster` | 14+ cascade | Untracked helper; MemberSidebar import | members | B |
| Login `SocialLoginButtons` layout prop | 1 | Auth shared contract | auth | A |
| Register `isMockMode` import | 1 | Stale RegisterScreen | auth | A |
| LiveKitIntent watch/broadcast + capture APIs | ~10 | livekitTypes / screenShare / capture | live / voice | B (App imports Live) |
| `availableVersion` on update state | 2 | updateService | settings | B |
| Global nav `live` + `liveActive` | 2 | globalNavigation + V1 scope | navigation | B |
| GlobalEventsWorkspace props | 2 | events workspace | events | B |
| ProfileView bookmarks props | 1 | ProfileView | profile | B |
| DmActiveCallMiniPanel / dismiss | ~4 | DmCall contracts | dm | B |
| Companion `getPeerDirectReadState` | 1 | DM service | companion | A/B |
| RootDashboard `userId` / shell props | 2 | root dashboard | root | B |
| `.ts` import extensions | 2 | tsconfig `allowImportingTsExtensions` | build | A |
| Direct attachment signing exports | 6 | upload helper lag | dm | B |
| `MESSAGE_SEND_FORBIDDEN` union | 1 | messageService codes | messages / live chat | B |

Cascades (TS7006 implicit any) were treated as symptoms of missing modules, not independent bugs.

---

## 2. Clean vs dirty classification (A–F)

Selected into commits (**A/B only**):

- **A:** `useLocalMessageState`, profile media types/resolver, `ensureCommunityMemberRoster`, auth login/register + SocialLoginButtons, feed realtime/query, deep-link smoke alignment, tsconfig, vite web entry, iconix symbols, secrets/mock/desktop smoke script sync, data-source mock-branch removals.
- **B (transitive App shell):** livekit/screen capture, updateService, global nav/live, events workspace, ProfileView, DM call/chime/attachment helpers, CompanionWindowManager, SoftEmailVerificationBanner CSS, RootDashboardApp userId (without UsersPage WIP dump).

**Rejected / not committed (D/E/F examples):**

- **D:** Root dashboard users WIP (`rootDashboardUserService`, large UsersPage rewrite), broadcaster/go-live migrations, email-worker/auth-gateway sites, brand asset binary churn beyond iconix, most docs/scripts WIP.
- **E:** `typecheck-out.txt`, tmp dumps, evidence scratch.
- **F:** `.env.local`, secrets, service-role material.
- **Stash:** left unapplied (`wip-non-settings-before-settings-package`, `temp-before-rebase-push`).

No `git add src`, no stash commit, no `@ts-ignore` / `any` stubs.

---

## 3. Logical commits (dependency closure)

Representative chain `fa35e7b8..6b0de2b2` (newest last):

1. `3781d449` chore(build): allow TypeScript extension imports  
2. `e51446b5` fix(messages): sendAttempt contracts  
3. `dee578c6` / `d6684478` fix(profile): username/verification projection + resolver  
4. `2b47a662` fix(members): ensureCommunityMemberRoster  
5. `22632f57` fix(auth): SocialLoginButtons + RegisterScreen  
6. `d4e44876` fix(livekit): intents + screen capture  
7. `be5a12b9` fix(desktop): availableVersion  
8. `358fb912` fix(navigation): live workspace contracts  
9. `cb3736d7` fix(events): GlobalEventsWorkspace props  
10. `0a223e8f` fix(profile): ProfileView bookmarks props  
11. `e36fe3c3` / `e2093e4e` / `a201023d` / `ef2dab4c` / `89467e63` fix(dm): call panel, peer read, attachment signing, view handlers, chime/dismiss  
12. `3c74c45e` fix(messages): MESSAGE_SEND_FORBIDDEN  
13. `6d3f620c` / `46d1f21d` / `964b4183` / `29038afe` fix(root): App userId; avoid UsersPage WIP; UTF-8 restore  
14. `f85b2b17` fix(electron): CompanionWindowManager  
15. `d7d25631` / `4f446939` fix(web): vite.config.web + index.web.html  
16. `93ec86de` fix(feed): realtime teardown + no mock query fallback  
17. `459a5c3b` / `e283fadb` / `a42211be` test(*): smoke assertion alignment  
18. `375dc602` fix(ui): iconix calendar/live symbols  
19. `01c3c656` fix(desktop): email banner CSS desktop-only  
20. `6b0de2b2` fix(data-source): remove mock branches from channel/members/reactions  

---

## 4. Error-count progression (clean worktree)

| Tip | `npm run typecheck` errors |
|---|---|
| `ffcb7bf6` (earlier) | 94 |
| `fa35e7b8` | 50 |
| after messages/profile/auth/livekit/nav/dm/root batch (`6d3f620c`) | 11 |
| after attachment/resolver/DM/messageService (`46d1f21d`) | 4 |
| after chime + UsersPage revert (`964b4183`) | **0** |
| final `6b0de2b2` | **0** |

No commit increased the error count after investigation; UsersPage WIP commit was reverted when it introduced missing-module cascades.

---

## 5. Clean tip verification (`picom-feed-production-wt` @ `6b0de2b2`)

```
git status --short → empty
npm ci → PASS (prior)
npm run typecheck → 0
npm run qa:smoke → 0
npm run build:web → 0
npm run electron:build → 0
```

Feed / related smokes (all exit 0): companion, query, mentions supabase, security definer, actions, media, storage security static, attachment signing, pagination, i18n parity, perf synthetic, mapper, realtime cache.

Evidence: `docs/audit/evidence/feed-packaged-e2e-closure-2026-08-02/clean-static-final-exits.txt`

---

## 6. Fresh staging package

| Field | Value |
|---|---|
| Command | `npm run package:win:dir:staging` |
| Package commit | `6b0de2b2` |
| Branch | `feat/community-rebuild` |
| Git status (worktree) | clean |
| Executable | `C:\Users\ACER\Desktop\picom-feed-production-wt\release\win-unpacked\Picom.exe` |
| App version | `0.1.1-beta.10` |
| SHA-256 | `F0C44A4EE4A8EB98ABC9CA9976CCE5E98E095D7BFDBC40FE530B496B200F5D26` |
| Electron | `43.0.0` |
| Chromium | NOT_MEASURED_FROM_RUNTIME |
| Node | `v24.15.0` |
| Windows | `10.0.26200` |
| Arch | `AMD64` |
| Env profile | staging / beta / supabase / `ufmtvqtsklqsmqxefbbs` |
| Auth gateway | `https://auth.picom.gg` |
| Account center | `https://account.picom.gg` |
| Evidence | `docs/audit/evidence/feed-packaged-e2e-2026-08-02T12-46-15` |

ASAR static preflight markers (`preflight-env-markers.json`): `staging=true`, `beta=true`, `supabase=true`, `projectRef=true`.

---

## 7–12. Packaged interactive matrix

| Area | Status |
|---|---|
| Env/config preflight (asar markers) | PASS (static) |
| Login/session / `/feed` interactive | **NOT_RUN** |
| Pagination / private media / deep-link / realtime 2-client | **NOT_RUN** |
| Live Now / Companion / Connected Voice | **NOT_RUN** |
| Read/save/reaction/reply / TR-EN / a11y / narrow | **NOT_RUN** |
| Restart persistence | **NOT_RUN** |
| Browser FPS / Electron memory | **NOT_RUN** |
| Log leak classification (packaged runtime) | **NOT_RUN** |

---

## 13. Production migration list (not applied)

1. `supabase/migrations/20260802030000_feed_ranked_audio_helper_grants.sql`  
2. `supabase/migrations/20260802110000_feed_attachment_storage_path_projection.sql`  

```
PICOM FEED PRODUCTION PROMOTION: PENDING
```

---

## 14. Remaining NOT_RUN (for Production GO)

1. Interactive packaged Feed preflight (login → `/feed` → MentionFeedMain)  
2. Full packaged E2E matrix §§5–16 from the gate checklist  
3. Browser FPS + Electron memory under 25/100/500/1000 scenarios  
4. Production migration apply (separate promotion task)  

---

## 15. Final verdicts

```
PICOM FEED CLEAN DEPENDENCY CLOSURE: GO
PICOM FEED PACKAGED E2E GATE: NO-GO
PICOM FEED PRODUCTION GATE: NO-GO
PICOM FEED STAGING PRODUCTION-READINESS: GO
PICOM FEED PRODUCTION PROMOTION: PENDING
```

Clean committed tip typechecks/builds/packages. Next operator step: run interactive packaged E2E + measured FPS/memory against the SHA above, then flip Packaged E2E / Production gates only if the full matrix passes.
