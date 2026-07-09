# Picom Stable Release Candidate Build

## Current decision

**Status: BLOCKED - no stable RC artifact or stable version was produced.**

Source candidate `0.1.1-beta.1` passes repository static QA, Supabase structural/API regression, LiveKit structural, Electron packaging configuration, license notice, typecheck, mock smoke, and production frontend/Electron build. These checks do not replace live staging, native platform, legal, backup/restore, or signing evidence required for stable distribution.

## Evidence summary

| Gate | Result | Evidence/limitation |
| --- | --- | --- |
| QA smoke | Pass | `npm run qa:smoke` |
| TypeScript/build | Pass | `npm run typecheck`, `npm run build` |
| Mock mode | Pass | `npm run mock:smoke` |
| Supabase source/schema/API paths | Pass structurally | `npm run qa:supabase`; no live project test |
| RLS | Pass structurally | Prepared pgTAP scenarios; Supabase CLI/live execution missing |
| LiveKit | Pass structurally | Service/UI/function/IPC smoke; no deployed two-client test |
| Electron packaging config | Pass | `npm run packaging:smoke` |
| Windows beta package | Available unsigned | `0.1.1-beta.1`; stable signing/lifecycle smoke incomplete |
| Linux package | Blocked | Native AppImage/deb build/smoke not run |
| macOS package | Blocked | Native dmg/zip/sign/notarize/permissions not run |
| Backup/restore | Placeholder/document pass | No real timed restore drill evidence |
| Legal/policy | Blocked | Terms/Privacy are beta placeholders; sign-off/consent records incomplete |
| Known issues | Reviewed | Stable blockers listed below and in beta known issues |

## Stable RC blockers

1. Install Supabase CLI and run real migrations/pgTAP/access matrix in isolated staging matching production.
2. Verify deployed private Storage, signed URL refresh, attachment reload/access loss, and object recovery. Historical private attachment signed-URL refresh is not wired end-to-end.
3. Run two-window Realtime insert/update/delete/reconnect/private-subscription tests.
4. Deploy/verify `livekit-token`; complete two-user voice/screen-share/cleanup tests on supported native platforms.
5. Build and smoke AppImage/deb on native Linux, including X11/Wayland media paths.
6. Build/sign/notarize/staple and smoke dmg/zip on native macOS, including final bundle permission behavior.
7. Approve and execute stable Windows signing/timestamp and clean-host install/upgrade/uninstall/reinstall smoke.
8. Run a real isolated backup restore drill and record RTO/RPO/integrity/application evidence.
9. Obtain legal/product/privacy approval for Terms, Privacy, consent versioning, support/contact, data handling, and third-party release notices.
10. Resolve or explicitly approve the Vite large-chunk performance warning against the performance budget.

No blocker may be converted to “pass” using mock/static documentation alone.

## Build procedure after blockers close

1. Freeze release source/migration/function set and update changelog/release notes.
2. Confirm all checklist evidence links and sign-offs.
3. Set a reviewed stable semver/release channel; do not reuse the beta artifact.
4. Run clean `npm ci`, quality, Supabase/LiveKit staging, RLS, legal, and platform packaging gates.
5. Build/sign artifacts independently on native protected runners.
6. Run clean-host smoke, generate checksums/provenance, and compare artifact metadata.
7. Complete go/no-go; this task still does not publish.

## Scope control

- No new product features belong in the RC pass.
- Fix only confirmed blockers; move non-blockers to known issues/backlog.
- Preserve Electron custom chrome, desktop-only UI, Supabase authorization, and LiveKit server token boundary.
- Keep `publish: null` until the separate stable distribution task and approval.
