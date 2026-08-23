| Scenario | Result | Evidence | Notes |
| --- | --- | --- | --- |
| SHA256 re-verify | PACKAGED_PASS | artifact-sha256.txt | Matches TASK 13A SHA |
| Isolated fresh profile | PACKAGED_PASS | isolated-profile/ | No 13/13A reuse |
| Remote version policy | PACKAGED_PASS | remote-config.json | remote / min 0.1.1-beta.10 / supported |
| Welcome → Login packaged flow | PACKAGED_PASS | screenshots/01–12 | Continue to sign in |
| Personalize Gaming+Friends | PACKAGED_PASS | screenshots/02-personalize-gaming-friends.png | Plan includes Privacy; Review All present |
| Appearance controls + 125% | PACKAGED_PASS | appearance-scale-layout.json | Footer/titlebar OK; no h-scroll |
| Appearance restart resume | PACKAGED_PASS | screenshots/03b-appearance-resume-first-paint.png | Dark/Compact/Large/125%; no white flash |
| Microphone silence | PACKAGED_PASS | physical-notes.json | Headset meter 0, Listening |
| Microphone physical input | PACKAGED_PASS | screenshots/05b-mic-amd.png | AMD array Input detected |
| Microphone cleanup ×3 | PACKAGED_PASS | physical-notes.json | No leftover live tracks |
| Microphone hotplug | BLOCKED_ENVIRONMENT | physical-notes.json | No safe removable mic |
| Speaker physical heard | BLOCKED_ENVIRONMENT | physical-notes.json | API only; not claimed heard |
| Camera physical preview | BLOCKED_ENVIRONMENT | camera-retest.json | ACER HD present; CAMERA_BUSY |
| Camera cleanup | PACKAGED_PASS | physical-notes.json | No leftover preview |
| Camera hotplug | BLOCKED_ENVIRONMENT | physical-notes.json | No safe removable camera |
| Screen picker + preflight | PACKAGED_PASS | screenshots/07-screen-preflight-safe.png | Picom Desktop 1280×800 |
| Screen picker cancel | PACKAGED_PASS | camera-retest.json | Choose a source; no live video |
| Screen stop cleanup ×3 | PACKAGED_PASS | physical-notes.json | Tracks ended |
| Windows login-item mutate/restore | PACKAGED_PASS | startup-restore-proof.json | Original false restored |
| Close-to-tray + restore | PACKAGED_PASS | start-in-tray-retest.json | Same window |
| Second instance | PACKAGED_PASS | physical-notes.json | 6 processes unchanged |
| Start-in-tray | PACKAGED_PASS | start-in-tray-retest.json | 0 visible windows, then restore |
| Quit mode | PACKAGED_PASS | physical-notes.json | Process count 0 |
| Notification capability | PACKAGED_PASS | screenshots/09-notifications.png | native supported |
| Notification creation | PACKAGED_PASS | physical-notes.json | sendTest ok/native |
| Toast visibility | BLOCKED_ENVIRONMENT | physical-notes.json | Not visually observed |
| Notification click | BLOCKED_ENVIRONMENT | physical-notes.json | No visual toast / no nav fixture |
| Privacy deferred | PACKAGED_PASS | screenshots/10-privacy-deferred.png | Review after sign-in |
| Ready factual summary | PACKAGED_PASS | screenshots/11-ready.png | No fake 100% |
| Ready review actions | PACKAGED_PASS | operator-log.txt | Audio/Desktop/Notifications/Privacy |
| Completion → Login | PACKAGED_PASS | screenshots/12-login-after-completion.png | Media released |
| Restart suppresses first-run | PACKAGED_PASS | screenshots/13-restart-after-completion.png | Login + prefs kept |
| Legacy completed fixture | PACKAGED_PASS | legacy-fixtures.json | Isolated only |
| Legacy permissions → notifications | PACKAGED_PASS | legacy-fixtures.json | Isolated only |
| Automated regressions | PACKAGED_PASS | suites/_summary.txt | All exit 0 |
| Auth packaged E2E | BLOCKED_TEST_IDENTITY | screenshots/12-login-after-completion.png | TASK 13C |
