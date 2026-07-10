# First Launch Setup QA and Reset Tools

## Test matrix

Run the first-launch flow in light and dark themes on Windows, Linux, and macOS.
Verify normal-window and maximized layouts at the 1100x700 minimum and the
1440x900 default size.

1. Start with no Picom local settings.
2. Confirm the setup opens before login and does not request permissions.
3. Move forward and backward through all five steps.
4. Select each theme and confirm it applies immediately.
5. Finish setup and confirm login appears.
6. Restart Picom and confirm completed setup does not reappear.
7. In a development build, open Settings > Advanced and select
   `Reset first-launch setup`.
8. Restart Picom and confirm setup appears again.

The reset tool preserves authentication, drafts, cache, and all settings except
the first-launch completion flag. It is compiled behind `import.meta.env.DEV`
and must not be visible in production builds.

## Corruption recovery

The local settings service validates stored data, attempts registered schema
migrations, and falls back to safe defaults when parsing or migration fails.
Corrupted settings must not prevent the renderer from showing basic setup/login
UI. Migration warnings must remain redacted and must never include auth secrets.

## Automated checks

```bash
npm run first-launch:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

Native visual and keyboard-navigation checks still require each target operating
system. Do not treat a Windows-only run as Linux/macOS completion.
