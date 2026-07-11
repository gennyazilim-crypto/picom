# Visual regression CI policy

## Current enforcement

CI runs `npm run visual:regression:contract` on Windows and Ubuntu. The gate validates that critical desktop coverage remains declared with deterministic mock data, 1440x900 viewport, reduced motion and both themes:

- Mention Feed
- full Profile
- Community Chat four-column layout
- Settings
- Voice room
- Radio Community
- Podcast Community library/publishing/moderation shell
- Podcast episode detail/player/interactions

This is a **coverage-contract gate**, not a pixel-diff gate. It fails if required scenarios, desktop viewport, stable mock mode or reduced-motion rules are removed.

## Why screenshot execution is disabled

Playwright is not installed and Picom has no reviewed per-platform baselines. Enabling pixel comparison now would either add a heavy dependency without an approved harness or produce flaky failures from fonts, GPU/compositing, Electron/Chromium, OS rendering and animations.

The manifest intentionally states:

- `enabled: false`
- `blockingMode: contract_only`

The validation script fails if those are changed without first implementing the approved screenshot system.

## Future Playwright architecture

When approved:

1. Add a pinned `@playwright/test` version and browsers through the dependency/license/update process.
2. Start Vite in deterministic mock mode with fixed locale/timezone, seeded IDs/dates, no network, reduced motion and 1440x900 viewport.
3. Add stable programmatic navigation/test hooks for each manifest screen; do not change user UI for tests.
4. Wait for fonts/images/layout and mask only truly nondeterministic system surfaces.
5. Keep separate Windows/Linux baselines; add macOS in signed/release runner or manual RC evidence if CI is unavailable.
6. Capture screenshots as CI artifacts on failure.
7. Tune thresholds with repeated runs before making diffs blocking.
8. Require explicit human review for baseline updates.

Prefer browser renderer captures for deterministic layout checks, then a smaller packaged Electron smoke set for custom chrome/window behavior. Do not fake native titlebar/menu verification in browser screenshots.

## Baseline policy

- Baselines are versioned and reviewed like source.
- A feature change updates only affected baselines with explanation.
- Never auto-accept screenshots in CI.
- Store no credentials, user data, private messages or external copyrighted images.
- Use existing safe mock avatars/artwork and Picom/Coolicons assets.
- Record Playwright/Electron/OS/font versions.
- Repeated flaky scenarios are quarantined as non-blocking with owner and deadline; do not silently raise thresholds.

## Initial screenshot thresholds

Choose thresholds after at least 20 clean repetitions per OS. Start with exact layout matching where deterministic and a small reviewed pixel ratio only for antialiasing-sensitive surfaces. Any threshold is documented by scenario and cannot conceal structural shifts, overflow, missing columns, theme changes or broken overlays.

## Manual RC checks until activation

- Capture all declared manifest scenarios at their configured desktop viewport.
- Confirm no mobile UI, horizontal overflow or Discord assets/colors.
- Confirm normal/maximized frame, fixed sidebars, independent chat scroll and pinned composer.
- Compare light/dark typography, tokens, icons, overlays and voice screen.
- Attach evidence to RC dry run and record reviewer/result.

## Activation gates

- stable navigation/mock fixtures and local screenshot command;
- pinned Playwright dependency and license/security review;
- repeated Windows/Linux stability and macOS evidence strategy;
- approved baselines and artifact retention;
- flake/threshold policy, owner and failure triage runbook;
- no regression to startup performance or packaging.

Until these gates pass, CI contract enforcement is blocking while pixel differences remain non-blocking/manual.
