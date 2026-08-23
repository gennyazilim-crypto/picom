# TASK 13B — Windows physical / native packaged acceptance

**TASK 13B VERDICT: CONDITIONAL_PASS**

Core packaged Welcome → Ready → Login completed on SHA `e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3`. No product code was changed. No P0/P1/P2 defect remains. Hardware-observation-only gates that could not be completed safely: speaker-heard, Windows toast visibility, camera exclusive capture (device busy), hotplug.

## Exact statuses

WINDOWS PACKAGED FIRST-RUN: PASS
MICROPHONE PHYSICAL ACCEPTANCE: PASS
MICROPHONE HOTPLUG: BLOCKED_ENVIRONMENT
SPEAKER PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT
CAMERA PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT
CAMERA HOTPLUG: BLOCKED_ENVIRONMENT
SCREEN CAPTURE PACKAGED ACCEPTANCE: PASS
WINDOWS LOGIN-ITEM ACCEPTANCE: PASS
WINDOWS TRAY/CLOSE ACCEPTANCE: PASS
WINDOWS NOTIFICATION CREATION: PASS
WINDOWS TOAST VISIBILITY: BLOCKED_ENVIRONMENT
AUTH PACKAGED E2E: BLOCKED_TEST_IDENTITY

## A. TEST ENVIRONMENT

Physical Windows 10.0.26200. Packaged Electron, not `electron:dev`. Isolated `PICOM_USER_DATA_DIR` only. `%APPDATA%\Picom` not used.

## B. ACCEPTANCE ARTIFACT

Version `0.1.1-beta.11`
Executable `C:\Users\ACER\AppData\Local\Temp\picom-task13a-20260816T1932Z\win-unpacked\Picom.exe`
Build timestamp `2026-08-16T21:33:20+02:00`

## C. SHA256 VERIFICATION

Expected and actual: `e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3`
Match: yes. No rebuild. Old TASK 13 SHA remains obsolete; this is still the TASK 13A acceptance SHA.

## D. ISOLATED PROFILE

`isolated-profile/` was empty at launch. First-run incomplete, no purposes, no media-test success, no completed flag. 13/13A profiles were not reused. Additional isolated dirs: `isolated-profile-media`, `legacy-completed-profile`, `legacy-permissions-profile`.

## E. PACKAGED FLOW

WINDOWS PACKAGED FIRST-RUN: PASS

Welcome → Personalize → Appearance → Audio & Video → Desktop → Notifications → Privacy deferred → Ready → Continue to sign in → Login.

Remote policy: source `remote`, minimum `0.1.1-beta.10`, client `0.1.1-beta.11`, decision supported, no Update required overlay.

## F. PERSONALIZATION

Gaming + Friends. Guided plan: Appearance, Audio & Video, Desktop, Notifications, Privacy, Ready. Progress “Step 2 of 8”. Review All still available. No automatic permission request. No setting mutation from purposes.

## G. APPEARANCE

System / Light / Dark, Comfortable / Compact, Default / Large / Extra large, 90 / 100 / 110 / 125 all clicked. 125% layout: titlebar close reachable, footer visible, no permanent horizontal scrollbar. Reduce motion, enhanced contrast, strong focus applied.

Persisted non-default combo: Dark, Compact, Large, 125% (operator `110%` click hit the Large text-size hint; 125% is still a valid non-default scale). Restart resumed Appearance with the same theme, density, text, scale, and locale. First paint `rgb(28, 33, 31)` / theme dark — no major white flash.

## H. MICROPHONE

Before Enable: no live audio tracks.
Enable microphone: audio-only path, real device list.
Headset path: silence stayed Listening, meter 0 — no false pass.
AMD array path: Input detected, meter responded — actual packaged input.
Start/stop ×3: one live track while testing, zero after stop. No escalating capture.
Hotplug: BLOCKED_ENVIRONMENT (no safely removable external mic).

Selected user-facing labels (IDs redacted): Corsair VOID wireless headset microphone; Microphone Array (AMD Audio Device).

## I. SPEAKER

Test speakers invoked from user action only. Selected sink: system default Realtek output. API started. No reliable human/audio observation — SPEAKER PHYSICAL ACCEPTANCE: BLOCKED_ENVIRONMENT.

## J. CAMERA

ACER HD User Facing is present. UI lists it with `{ audio: false }` getUserMedia on Start preview. Windows returned CAMERA_BUSY (“busy in another application”). No live frame. No camera screenshot stored. Start/stop did not leave a background preview. Hotplug: BLOCKED_ENVIRONMENT.

## K. SCREEN CAPTURE

In-app Electron source list: 6 sources, screens and windows. Safe source “Picom Desktop” produced a live local preflight 1280×800, no LiveKit/publish/upload. Re-open picker without selecting: no success / no live video. Stop closed tracks. Three start/stop cycles: no leftover capture.

## L. DESKTOP / TRAY

Native launch-at-login original: disabled / no Picom Run value. Toggled on, verified, restored off. Proof in `startup-restore-proof.json`. Host Run key remains `NO_PICOM_RUN_VALUE`.

Close-to-tray: titlebar X hides, process stays (6 Electron processes), tray.showWindow restores the same window. Repeat + second instance: still 6 processes, existing window focused. Quit PICOM + titlebar: process count 0. Start-in-tray via `--picom-login-startup`: 0 visible main windows, then tray show restores 1. `document.hidden` is not a reliable Electron hide probe.

## M. NOTIFICATIONS

Capability native-available / supported. No browser permission prompt. `notifications.sendTest` returned `{ ok: true, native: true }`. Toast visibility not observed. Click-to-restore not exercised (no visual toast; test fixture has no navigation payload). Preferences persisted: Focused-style categories, Quiet Hours 22:00–07:00, DND.

## N. PRIVACY PRE-AUTH

Deferred card “Review after sign-in”. No interactive account policy controls. No anonymous RPC. Ready row status `deferred`.

## O. READY

Mixed factual summary: Appearance configured (Dark/Compact/Large/125%), microphone Configured (not Tested — headset did not pass on the first profile), camera Not tested, screen Not tested after explicit Stop, Desktop Off / start-in-tray / close-to-tray, notifications Available, Privacy Review after sign-in. No fake 100%. Review Audio, Desktop, Notifications, Privacy each returned to the stable step and back to Ready.

## P. COMPLETION / LOGIN HANDOFF

Continue to sign in persisted completion, cleared purposeIds, released media, showed Login. Auth path stopped.

## Q. RESTART / RESUME

Same isolated profile: first-run does not reopen, Login shown, Dark/Compact/Large/125% remain. Appearance mid-flow quit/resume also passed. Audio/Notifications/Desktop quit/resume covered by the desktop quit and appearance restart. Legacy completed fixture suppresses first-run. Legacy `permissions` fixture migrates to Notifications (packaged isolated profile).

## R. RESOURCE OBSERVATION

Mic ×3, camera attempts, screen ×3: no lingering indicators, no duplicate capture growth, no progressively slower UI. Manual observation only.

## S. PERFORMANCE

Human-scale, not laboratory:
- Launch → interactive Welcome ≈ 0.9–2 s
- Step transitions: immediate
- Screen picker open ≈ 1.1 s
- Ready → Login ≈ 0.2 s
- Camera preview start: environment-busy, not a latency sample

## T. VISUAL ISSUES FOR TASK 14

See `visual-issues.md`. P3/P4 only.

## U. AUTOMATED REGRESSION

All required suites exit 0. See `suites/_summary.txt`.

## V. EVIDENCE LOCATION

`docs/audit/evidence/first-launch-windows-native-e2e-2026-08-16T1945Z/`

## W. DIRTY TREE

Preserved. No reset, stash, checkout, stage, commit, push, or clean. HEAD `af6babcf060da058fb295b7b37c27f75ca5c6f25` on `feat/community-rebuild`. Short-status line count 464 before and after (evidence path is not additional product mutation).

## X. REMAINING BLOCKERS

- TASK 13C auth / legal / account onboarding (`BLOCKED_TEST_IDENTITY`)
- Speaker-heard observation
- Windows toast visibility / notification click
- Exclusive camera capture (host camera busy)
- External mic/camera hotplug hardware
