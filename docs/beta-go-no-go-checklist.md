# Beta Go / No-Go Checklist

Use this checklist before distributing a Picom beta build to testers.

## Decision options

- `Go`: all blocker checks passed.
- `Go with known non-blockers`: blockers passed, known issues documented.
- `No-Go`: at least one blocker remains.
- `Delay`: more verification is required before making the decision.

## Required references

- Beta environment: `docs/beta-environment.md`
- Beta release notes: `docs/beta-release-notes.md`
- Known issues: `docs/known-issues.md`
- Bug triage workflow: `docs/beta-bug-triage.md`
- Feedback/logs placeholder: `docs/feedback-and-logs.md`
- Packaging hardening: `docs/packaging-hardening.md`
- Windows smoke test: `docs/windows-smoke-test.md`
- Linux smoke test: `docs/linux-smoke-test.md`
- macOS smoke test: `docs/macos-smoke-test.md`

## Product readiness

- [ ] Picom app name and identifier are correct.
- [ ] No mobile UI or mobile navigation exists.
- [ ] No Discord branding, logo, copied assets, copied icons, or exact colors exist.
- [ ] Coolicons/AppIcon remains the approved icon path.
- [ ] Beta release notes are current.
- [ ] Known issues are current.
- [ ] Beta feedback/diagnostics flow is documented and safe.

## Desktop UI readiness

- [ ] App opens in Electron dev mode.
- [ ] Native File/Edit/View menu is hidden.
- [ ] Custom Picom titlebar is visible.
- [ ] Window controls work.
- [ ] Default window size target is `1440x900`.
- [ ] Minimum window size target is `1100x700`.
- [ ] Four-column desktop layout is stable.
- [ ] No horizontal overflow appears.
- [ ] Composer remains pinned.
- [ ] Chat scrolls independently.
- [ ] Light theme is usable.
- [ ] Dark theme is usable.
- [ ] Settings modal opens.
- [ ] Context menus open.
- [ ] Image preview opens.
- [ ] Profile popover/foundation opens where available.

## Mock mode readiness

- [ ] `VITE_DATA_SOURCE=mock` starts without backend.
- [ ] Community switching works.
- [ ] Channel switching works.
- [ ] Local message sending works.
- [ ] Member search works.
- [ ] Settings and theme changes do not crash.
- [ ] `npm run mock:smoke` passes.

## Supabase beta readiness

- [ ] `.env.local` is created from `.env.beta.example`.
- [ ] No service-role key is present in renderer-visible env variables.
- [ ] Supabase URL and anon key are beta placeholders or valid beta values.
- [ ] Auth login/register path is smoke tested.
- [ ] Session restore is smoke tested.
- [ ] RLS policies are tested for private/community data boundaries.
- [ ] Supabase Realtime two-window smoke test is complete.
- [ ] Supabase Storage upload smoke test is complete when storage is enabled.

## LiveKit beta readiness

- [ ] LiveKit public URL is configured for beta.
- [ ] API key/secret remain server-side only.
- [ ] Voice join/leave smoke test is complete.
- [ ] Mute/deafen smoke test is complete.
- [ ] Screen-share picker smoke test is complete.
- [ ] Windows permission behavior is documented.
- [ ] Linux permission behavior is documented.
- [ ] macOS permission behavior is documented.

## Packaging readiness

- [ ] `npm run package:verify` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Windows package smoke test is complete or a blocker is documented.
- [ ] Linux package smoke test is complete or a blocker is documented.
- [ ] macOS package smoke test is complete or a blocker is documented.
- [ ] Unsigned local build behavior is documented.
- [ ] Icons appear correctly in packaged app outputs.

## Security readiness

- [ ] Logs redact passwords, tokens, cookies, authorization headers, API keys, service-role keys, and private secrets.
- [ ] Preload exposes only the safe `window.picomDesktop` bridge.
- [ ] `contextIsolation` is enabled.
- [ ] `nodeIntegration` is disabled.
- [ ] Renderer sandbox is enabled.
- [ ] External links are safely routed.
- [ ] Top-level renderer navigation is guarded.
- [ ] Webview attachment is blocked.
- [ ] No signing keys or production secrets are committed.

## Beta blocker list

Mark `No-Go` if any item is true:

- [ ] App does not start.
- [ ] Renderer startup crashes repeatedly.
- [ ] Login/register is unusable in the chosen beta mode.
- [ ] Core message send path is broken.
- [ ] Four-column desktop layout is broken at `1440x900`.
- [ ] Minimum size behavior is broken at `1100x700`.
- [ ] Private data or secrets are exposed.
- [ ] Native bridge exposes unsafe APIs.
- [ ] Target platform package cannot launch.
- [ ] Known blocker exists in `docs/known-issues.md`.

## Final decision

- Decision: `Go | Go with known non-blockers | No-Go | Delay`
- Date:
- Build/version:
- Release channel:
- Reviewer:
- Notes:

## Sign-off placeholders

- Product:
- Engineering:
- QA:
- Security:
- Operations/support:
