# First-Run Performance Budget

Picom is a premium Electron desktop community chat app for Windows, Linux, and macOS. This budget defines the first-run and common-interaction performance targets for the MVP so startup, chat, and desktop overlays stay fast as Supabase, LiveKit, and production services grow.

Mobile targets are intentionally out of scope. These numbers assume a packaged desktop build on a mid-range laptop with a 1440x900 window and mock or staging data.

## Budget table

| Area | MVP target | Regression threshold | Measurement method | Notes |
| --- | ---: | ---: | --- | --- |
| App shell first render | <= 1.5s | > 2.0s | Electron dev/prod startup timing from process launch to first visible shell | Titlebar, frame, and empty/protected shell visible. |
| Login screen render | <= 1.2s | > 1.8s | Fresh install/no session, time to interactive login/register view | No Supabase request should block first paint. |
| Main chat render with mock data | <= 1.8s | > 2.5s | Mock mode load to visible 4-column desktop layout | ServerRail, CommunitySidebar, ChatMain, MemberSidebar visible. |
| Settings modal open | <= 180ms | > 300ms | Click settings to modal visible | Heavy settings sections should remain lazy/light. |
| Command palette open | <= 120ms | > 220ms | Ctrl+K to searchable palette focused | Search input must receive focus quickly. |
| Channel switch | <= 150ms | > 300ms | Click channel to visible message list update | Includes active state and composer placeholder update. |
| Message send optimistic update | <= 80ms | > 150ms | Enter in composer to pending/visible local message | Network confirmation can arrive later. |
| Image attachment preview | <= 250ms | > 500ms | Select local image to preview card visible | Object URL creation must not leak memory. |
| Image preview modal open | <= 180ms | > 350ms | Click image attachment to preview modal visible | Full image can continue loading after shell opens. |
| Memory usage placeholder | <= 350 MB after 10 min mock session | > 500 MB | OS task manager or Electron process memory | Includes switching communities/channels and opening overlays. |
| Renderer JS bundle placeholder | <= 900 KB minified initial JS | > 1.2 MB | Vite build output | Voice/LiveKit and optional heavy views should be split when practical. |
| CSS bundle placeholder | <= 180 KB minified | > 240 KB | Vite build output | Tokenized desktop UI can grow, but unused style paths should be trimmed. |

## Required measurement flows

1. Start from a clean local settings/cache profile.
2. Launch Electron production-like build where possible.
3. Confirm no native File/Edit/View menu appears.
4. Measure first visible shell or login render.
5. Enter mock mode and load the default 4-column community layout.
6. Switch between at least three communities and five channels.
7. Send three rapid local messages and confirm optimistic ordering.
8. Open Settings, Command Palette, context menu, profile view, image preview, and mention feed.
9. Repeat light and dark theme once.
10. Watch memory for at least 10 minutes after normal desktop usage.

## Recommended tools

- Vite build output for bundle size tracking.
- Chrome/Electron DevTools Performance panel for interaction traces.
- Windows Task Manager for coarse memory checks.
- Linux System Monitor or `ps`/`top` for coarse memory checks.
- Playwright screenshots/perf placeholders when visual regression tests are enabled.
- Future CI artifact parser for `dist/assets` bundle sizes.

## Regression policy

Performance regressions should be treated as release blockers when any of these are true:

- Startup/login/main chat render exceeds the regression threshold on a release candidate.
- A common desktop interaction becomes visibly delayed or blocks input.
- Bundle size crosses the threshold without an intentional architecture decision.
- Memory continues growing after repeated channel switches, image previews, or overlay opens.
- Optional services such as diagnostics, notifications, tray, or update checks block the first render.

Non-blocking regressions can ship only when documented in release notes with an owner and follow-up task.

## CI placeholder

A future CI job should:

1. Run `npm run build`.
2. Parse Vite output or inspect `dist/assets` sizes.
3. Compare initial JS/CSS assets against the budgets above.
4. Run mock smoke tests with reduced motion enabled.
5. Upload timing and bundle-size artifacts with the release candidate.

Until automated CI exists, release candidates should run this checklist manually and record results in the RC dry run document.

## Implementation guardrails

- Do not load Supabase, LiveKit, diagnostics, or optional native services before the desktop shell is visible unless required for a safe startup state.
- Keep mock mode fast and deterministic.
- Lazy-load heavy optional views when safe, especially voice/screen-share and future advanced features.
- Apply theme early to avoid light/dark flashing.
- Keep avatar/image placeholders bounded and avoid unbounded in-memory caches.
- Use design tokens and the existing desktop layout; do not add mobile fallbacks to satisfy performance goals.
