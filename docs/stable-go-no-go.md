# Picom Stable Go / No-Go

## Decision record

| Field | Value |
| --- | --- |
| Decision | **No-Go** |
| Date | 2026-07-10 |
| Evaluated source | `0.1.1-beta.1` / Task 39 source candidate |
| Stable artifact | Not produced |
| Public distribution | Not authorized |

The repository’s static/full-build gates pass, but stable readiness requires deployed and native evidence that cannot be replaced by mock/static checks. Picom remains in private beta preparation.

## Go criteria status

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Beta blockers resolved | Partial | Source QA blockers fixed; external stable blockers remain |
| No critical startup crashes | Static pass | QA/hooks/build pass; clean native target install matrix incomplete |
| No auth blockers | Static pass | Mock/API path pass; production-like Auth/OAuth/session smoke missing |
| No message-send blockers | Static pass | Mock/API path pass; deployed two-window Supabase smoke missing |
| No private channel/RLS leak | Structural pass only | Migration/pgTAP files pass static checks; real CLI/deployed account matrix missing |
| No token/password logging | Pass statically | Secret/log/diagnostics smoke passes; provider/CI artifact log audit missing |
| Packages open on target platforms | Fail | Windows beta installer exists; native Linux/macOS stable artifacts and smoke absent |
| Voice/screen-share limitations documented | Pass | Production setup/smoke docs exist; deployed two-client/native evidence missing |
| Legal/policy docs present | Present but unapproved | Legal checklist exists; Terms/Privacy remain beta placeholders |
| Rollback plan ready | Documented | Runbooks/checklists pass smoke; real backup restore drill and artifact rollback exercise missing |
| Known issues documented | Pass | Beta known issues and stable blockers recorded |

## Release blockers

1. Production-like Supabase migration, RLS, Auth, Storage, Realtime, and Edge Function verification is not complete; Supabase CLI is unavailable locally.
2. Historical private attachments lack end-to-end authenticated signed-URL refresh after reload.
3. LiveKit token deployment and two-client voice/screen-share/cleanup tests are not complete on target platforms.
4. Linux AppImage/deb native build and supported X11/Wayland smoke are not complete.
5. macOS dmg/zip signing, hardened runtime, notarization, Gatekeeper, and permission smoke are not complete.
6. Windows stable signing/timestamp and clean-host install/upgrade/uninstall/reinstall smoke are not complete.
7. No real isolated backup restore/rollback drill evidence exists.
8. Terms, Privacy, consent handling, licensing/publisher details, and legal/privacy sign-offs are not final.

Any private-data leak, credential exposure, widespread startup/auth/message failure, corrupted artifact, or unauthorized LiveKit token remains an automatic No-Go.

## Known non-blockers for private beta

- Vite reports chunks over 500 kB; optimization remains tracked and should be evaluated against the performance budget.
- Windows private beta installer is unsigned and can show SmartScreen warning when distributed only through approved beta channels with checksum.
- Some mock social/story/follow state remains local by design in mock mode.
- Optional post-MVP marketplace, plugin, enterprise, public discovery, auto-update, analytics, E2EE, and mobile work remains out of scope.

These non-blockers do not override stable blockers.

## Passed source gates

- QA smoke, TypeScript, mock smoke, Electron/renderer production build.
- Supabase schema/RLS/API structural smoke.
- LiveKit renderer/function/IPC structural smoke.
- Electron packaging/security, desktop-only, branding, secrets, diagnostics/log redaction, licenses, and documentation smoke.
- Backup/restore/rollback placeholder safety checks.

## Required actions before re-review

| Action | Owner | Evidence required |
| --- | --- | --- |
| Run production-like Supabase/RLS/Storage/Realtime/Auth/Function smoke | Backend/security | Redacted matrix and migration/function record |
| Implement/test historical private attachment URL refresh | Desktop/backend | Reload/expiry/access-loss test evidence |
| Run LiveKit native two-client matrix | Realtime/platform QA | Windows/Linux/macOS results |
| Produce/test signed target artifacts | Release/platform QA | Hash, provenance, signature/notary, lifecycle smoke |
| Execute restore/rollback drill | Operations/database | RTO/RPO/integrity/app smoke report |
| Complete legal/privacy/publisher sign-off | Product/legal/privacy | Signed checklist and final in-app documents |

## Sign-offs

| Area | Decision | Owner | Date |
| --- | --- | --- | --- |
| Product | No-Go pending blockers | Placeholder | 2026-07-10 |
| Engineering | No-Go pending external/native evidence | Placeholder | 2026-07-10 |
| Security/privacy | No-Go pending live RLS/Storage/legal evidence | Placeholder | 2026-07-10 |
| Operations/release | No-Go pending restore/signing/platform smoke | Placeholder | 2026-07-10 |
| Support | Not signed | Placeholder | |

## Re-review rule

Create a new decision record after every blocker has evidence, rerun the exact stable RC checklist, and identify the exact immutable artifacts. Do not mutate this No-Go into Go without dated named sign-offs. Stable distribution remains a separate task and requires explicit authorization.
