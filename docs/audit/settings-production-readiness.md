# PICOM Settings — Production Readiness Report

**Date:** 2026-08-01  
**Test end:** `2026-08-01T21:51:09+02:00` (fresh package evidence UTC: `2026-08-01T21:51:09.639Z`)  
**Surface:** Desktop Settings modal + main-process device settings IPC  
**Working tree:** **dirty** (~801 paths — stash applied on top of Settings commits; does **not** satisfy clean committed-tree gate)  
**Settings feature commit:** `1cda33bb4b0254eff982023dbf7efca25d7ceafb` — `feat(settings): complete production settings shell and persistence` (48 files)  
**Settings follow-up:** `63c3a793ec59ae3099a5aa6f52885abd3f256263` — `fix(settings): use extensionless settingsI18n imports for Node/tsc`  
**Repo HEAD (broader branch):** `4ae18de3037d1490b956ecca7e38ad72cd92244f` (parent of Settings stack; **clean checkout of parent alone fails typecheck** — required modules were untracked WIP)

## Final verdict

```text
PICOM SETTINGS PRODUCTION GATE: NO-GO
```

Packaged interactive Settings E2E (sections 7–16) remains **NOT_RUN**. Fresh static suite and branding/i18n fixes do **not** substitute for packaged verification. A win-unpacked build exists from a **dirty worktree**; it does **not** satisfy the clean committed-tree ship gate.

---

## 1. Final commit

| Field | Value |
| --- | --- |
| Settings release commits | `1cda33bb4b0254eff982023dbf7efca25d7ceafb` (feature) + `63c3a793ec59ae3099a5aa6f52885abd3f256263` (i18n import fix) |
| Clean-tree gate | **FAIL** — evidence below built with stash applied (~801 dirty paths), not a pure `git checkout` of Settings commits alone |
| Pure `git checkout 1cda33bb` | **FAIL** typecheck / package — companion, `ProfileDisplayName`, `loginMethodGuards`, account auth components, and other required modules lived as **untracked WIP**, not in that commit’s tree |
| Pure `git checkout 4ae18de` (parent) | **FAIL** typecheck on clean tree (same missing-module class) |
| App version | `0.1.1-beta.10` |

Settings source commits exist; **production GO** still requires a **clean** tree that typechecks, packages, and matches the shipped artifact — not met this turn.

---

## 2. Settings architecture

Unchanged shell model: modal, nav + content, collapsible narrow layout, TR/EN search catalog.  
Persistence tiers documented in `settingsPersistenceRegistry`:

- **main-process-device:** devices, window/startup, notification *delivery* keys  
- **user-account-synced:** theme_mode + *synced* notification categories  
- **account-center:** password / MFA / sessions / providers / delete  

---

## 3. Notification ownership

Canonical split implemented in `src/services/settings/notificationOwnership.ts` + schema **v10**:

| Tier | Keys | SoT |
| --- | --- | --- |
| **A Device** | `nativeDesktopEnabled`, `soundEnabled`, `quietHours`, `notifyWhileFocused`, `taskbarFlash`, `trayBadge`, `titlebarBadge` | Main-process `device-local-settings.v1.json` (+ local composed cache) |
| **B Synced** | categories (DM/mention/reply/…), `enabled`, `muted`, `digestMode`, `incomingCalls`, `missedCalls`, `securityAlerts` (locked true), `productAnnouncements`, … | Supabase `user_settings.notification_settings` |

Rules enforced in code:

- `syncAccountSettings` writes **synced payload only** (device keys stripped)  
- `hydrateAccountSettings` merges remote **without** overwriting device keys  
- unknown keys rejected via `rejectUnknownNotificationKeys`  
- sync failure rolls back optimistic local write for notification updates  
- OS permission `denied` → native/sound toggles show disabled (not fake enabled)  
- security alerts locked on; UI copy explains  

Unit: `node --experimental-strip-types scripts/settings-notification-ownership-unit.mjs` → exit **0** (**PASS**, schema v10)

Account Center `notification_preferences` remains a **separate** AC web table (not dual-written from Desktop Settings JSON). Desktop Settings does not treat it as SoT for desktop categories.

---

## 4. i18n completion

| Item | Result |
| --- | --- |
| Canonical catalog | `settingsI18n` + `settingsModalEn` + `settingsI18nTr` (~**883** EN/TR keys) |
| Wiring | Full `SettingsModal` + `src/components/settings/*` via `translateSettings` |
| `node scripts/settings-i18n-scan.mjs` | exit **0** — TR/EN parity, no TR=EN mirror for UX strings, no hardcoded aria/placeholder in `SettingsModal` |
| Interpolation / raw-key guards | Covered by settings production unit + i18n scan (static **PASS**) |
| Packaged language switch E2E | **NOT_RUN** |

---

## 5. Build results (static suite)

Evidence from **dirty / WIP-applied tree** unless noted.

| Command | Exit | Notes |
| --- | --- | --- |
| `node scripts/settings-i18n-scan.mjs` | **0** | PASS |
| `node --experimental-strip-types scripts/settings-production-unit.mjs` | **0** | PASS |
| `node --experimental-strip-types scripts/settings-notification-ownership-unit.mjs` | **0** | PASS |
| `npm run branding:smoke` | **0** | PASS (see section 17 — root cause fixed) |
| `npm run qa:smoke` | **0** | PASS |
| `npm run typecheck` | **0** | PASS on dirty/WIP-applied tree (**not** reproduced on pure clean checkout of `1cda33bb` or `4ae18de`) |
| `npm run build:web` | **0** | PASS — warnings: `INEFFECTIVE_DYNAMIC_IMPORT`, chunk >500kB → **harmless build warning** |
| `npm run electron:build` | **0** | PASS |
| `npm run package:win:dir` | **0** | PASS in dedicated **worktree** (`picom-settings-package-wt`) on dirty tree |

Build and static smoke ≠ Settings **GO** without packaged E2E (sections 7–16) and without clean-tree alignment.

### Fresh package attempt (dirty tree — not ship gate)

| Field | Value |
| --- | --- |
| Label | **Evidence only** — base commit `1cda33bb` with **dirty** tree (stash applied, ~801 paths); does **not** satisfy clean committed-tree gate |
| Executable | `C:\Users\ACER\Desktop\picom-settings-package-wt\release\win-unpacked\Picom.exe` |
| Package timestamp (UTC) | `2026-08-01T21:51:09.639Z` |
| SHA-256 | `90A7E07B68EC99D42FFC2743528F231B9125BFCE787E2588D85765F9000E77C1` |
| Evidence dir | `docs/audit/evidence/settings-packaged-2026-08-01T21-51-09-639Z` |
| Electron / arch | As recorded in evidence meta (win unpacked x64) |

### Historical intermediate package (superseded for SHA — retain for audit trail only)

| Field | Value |
| --- | --- |
| Label | **Historical intermediate only** — earlier dirty-tree run |
| SHA-256 | `06219C28A3A5E74D130FBB43A6C5765827A688909132DC0649523754E7260949` |
| Evidence | `docs/audit/evidence/settings-packaged-2026-08-01T18-28-40-010Z` |

Do **not** reuse prior Steam package SHA (`14FE279B…`) as Settings evidence.

---

## 6. Navigation / search

Code path: grouped nav + bilingual search index + highlight/scroll (prior + this pass).  
Packaged verification: **NOT_RUN**

---

## 7. Local persistence

Schema v10 + device store fields implemented in source.  
Packaged read/write without restart: **NOT_RUN**

---

## 8. Restart persistence

Theme, mic/speaker, bounds, startup, tray, sound, shortcuts — process-exit restart matrix.  
Packaged verification: **NOT_RUN**

---

## 9. Audio devices

Code: existing `VoiceDeviceSelection` / `voiceDeviceService`.  
Packaged real enumeration E2E: **NOT_RUN**  
Second device cases: **NOT_RUN — SECOND DEVICE UNAVAILABLE** (not claimed PASS)

---

## 10. Windows startup

Section + `startup` IPC wired.  
Packaged login-item ON/OFF + path verification: **NOT_RUN**

---

## 11. Tray

Existing tray IPC; Settings close-to-tray writes device store + tray bridge.  
Packaged lifecycle E2E: **NOT_RUN**

---

## 12. Storage / cache

`Storage` section + allowlisted `cache.*` / `appPaths.open`.  
Packaged clear/size/path-deny E2E: **NOT_RUN**

---

## 13. Account Center links

Summary + allowlisted deep links; no Desktop password/delete forms.  
Google paused / Epic setup-pending / Steam backend state in summary.  
Packaged openExternal matrix + negative URLs: **NOT_RUN**

---

## 14. IPC security

Allowlisted channels for settings/cache/paths (prior + notification device fields).  
Packaged negative IPC suite: **NOT_RUN**  
Existing scripts available: `electron:ipc-fuzz:test`, `electron:security:smoke` — **NOT_RUN** this turn

---

## 15. Packaged evidence (meta)

| Item | Result |
| --- | --- |
| Fresh win-unpacked + SHA on dirty worktree | Recorded — `90A7E07B…` / evidence dir above (**meta only**) |
| Settings nav/search/restart/audio/startup/tray/storage/AC/IPC/notification/i18n packaged runs | **NOT_RUN** |
| Screenshots (TR/EN/narrow) | **NOT_RUN** |

---

## 16. Console / log classification

Packaged Settings run console capture: **NOT_RUN**

---

## 17. Regression (static + branding)

### Branding smoke root cause (FIXED)

| Field | Detail |
| --- | --- |
| Failing assertion | Forbidden branding reference `\bdiscord\b` in `src/services/settingsService.ts` **comment** |
| Expected | No Discord branding references under scanned `src` / `electron` / assets rules |
| Actual | Comment text contained “Discord clone” |
| Fix | Comment rewritten; smoke rules **not** loosened |
| Desktop smoke (secondary) | `@media (max-width: 640px)` in `SettingsModal.css` forbidden by desktop-only smoke — merged into **720px** breakpoint (allowed) |
| `npm run branding:smoke` | exit **0** — **PASS** |
| `npm run qa:smoke` | exit **0** — **PASS** |

### Static regression matrix

| Suite | Exit | Result |
| --- | --- | --- |
| settings-i18n-scan | **0** | **PASS** |
| settings-production-unit | **0** | **PASS** |
| settings-notification-ownership-unit | **0** | **PASS** |
| branding:smoke | **0** | **PASS** |
| qa:smoke | **0** | **PASS** |
| typecheck | **0** | **PASS** (dirty/WIP-applied tree only) |
| build:web / electron:build / package:win:dir | **0** | **PASS** with harmless web warnings (package via worktree) |
| Packaged Settings E2E (§7–16) | — | **NOT_RUN** |
| auth smoke | — | **NOT_RUN** this turn |

---

## 18. NOT_RUN items

- Packaged Settings navigation/search/highlight/narrow (§6)  
- Local persistence packaged (§7)  
- Restart persistence — real process exit (§8)  
- Real audio device E2E (+ second device) (§9)  
- Windows startup login-item E2E (§10)  
- Tray lifecycle E2E (§11)  
- Storage/cache packaged E2E + path traversal (§12)  
- Account Center packaged deep-link + URL DENY matrix (§13)  
- IPC negative packaged suite (§14)  
- Notification packaged E2E (permission/focused/quiet/DND/badges)  
- i18n packaged switch + screenshots (§15)  
- Console classification for Settings packaged run (§16)  
- **Clean committed tree** that typechecks, packages, and matches release artifact without stash/WIP (~801 paths)  
- Packaged E2E against artifact built from that clean tree  

---

## 19. Remaining blockers

1. **Packaged Settings E2E (§6–16)** — navigation, persistence, restart, audio, startup, tray, storage, AC links, IPC negatives, notification behavior, i18n switch, console classification; screenshots — all **NOT_RUN**; do **not** mark PASS without execution  
2. **Clean-tree gate** — Settings commits `1cda33bb` / `63c3a793` exist, but ship evidence requires a **clean** checkout where typecheck and `package:win:dir` succeed **without** untracked companion/auth/WIP modules; pure checkout of `1cda33bb` or parent `4ae18de` **fails** today  
3. **Artifact alignment** — fresh SHA `90A7E07B…` is valid **dirty-worktree** evidence only; not a production ship binary until (2) is resolved and E2E (1) passes  
4. Optional: IPC fuzz + electron security smoke as supplemental Settings security evidence  

Removed as blockers (fixed / complete on static evidence): `branding:smoke` failure (comment + CSS breakpoint), partial SettingsModal i18n migration, static suite exits on WIP-applied tree.

---

## 20. Final verdict

```text
PICOM SETTINGS PRODUCTION GATE: NO-GO
```

**Reason:** Mandatory packaged E2E (sections 7–16) and packaged i18n/console evidence remain **NOT_RUN**. Static suite (i18n scan ~883 keys, notification ownership schema v10, typecheck/build/package on **dirty** tree, branding/qa smoke) is **PASS** but insufficient for GO. Clean committed-tree gate is **not** met (stash/WIP dependency; pure Settings-commit checkout does not typecheck/package). Fresh package SHA `90A7E07B68EC99D42FFC2743528F231B9125BFCE787E2588D85765F9000E77C1` is evidence for future E2E only.
