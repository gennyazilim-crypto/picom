# Settings Full MVP QA

## Scope

This audit covers the desktop Settings experience for Account, Profile, Privacy & Safety, Appearance, Accessibility, Language, Notifications, Voice & Video, Keyboard Shortcuts, Advanced, and Diagnostics.

## Behavior contract

| Area | Persisted through | Observable effect | QA gate |
| --- | --- | --- | --- |
| Account | Supabase Auth and account services | session, password, provider, export, deletion, and logout actions | `settings:account-security:smoke` |
| Profile and privacy | profile/privacy service layer | profile projection, blocking, DM/friend policy, and visitor-safe visibility | `settings:profile-privacy:smoke` |
| Appearance, accessibility, language | versioned settings service | document theme, density, motion, focus, locale, and date/time formatting | `settings:appearance-accessibility:smoke` |
| Notifications | notification preference service | category routing, quiet hours, sound, native delivery, and deduplication | `notifications:preferences:smoke` |
| Voice and audio | voice device service | permission state, device selection, microphone meter, speaker test, and media output | `voice:settings:smoke` |
| Keyboard shortcuts | keyboard shortcut service | conflict-safe shortcut registration and reset | `keyboard:shortcuts:final:test` |
| Advanced and Diagnostics | bounded desktop services | redacted diagnostics, cache actions, Safe Mode, layout/settings reset, and support export | `settings:advanced-diagnostics:smoke` |
| Persistence and recovery | settings schema 9 and local migration manifest 2 | restart hydration, legacy migration, bounded corrupt-data backup, and Safe Mode signal | `settings:architecture:smoke`, `local-data:migration:smoke` |

## Full MVP boundaries

- Production auto-update remains outside Full MVP and is disabled unless a signed release endpoint is configured. Development-only update state simulation remains behind `import.meta.env.DEV`.
- Automatic inactivity locking remains outside Full MVP. The visible control is disabled and the working `Ctrl + Shift + L` quick-lock path is documented in the UI.
- Start-minimized-to-tray is a device-local preference and only applies where native tray/startup support is available.
- A status page is optional and only opens when `VITE_STATUS_PAGE_URL` is configured.
- Settings components use service boundaries and do not query Supabase tables directly.

## Persistence and corruption checks

1. Change theme, density, language, notification, audio, and keyboard preferences.
2. Restart Picom and confirm the values hydrate from the versioned settings store.
3. In a development profile, replace `picom-settings` with invalid JSON and restart.
4. Confirm Picom falls back to normalized defaults, stores only bounded content-free corruption evidence, and raises the Safe Mode recovery signal.
5. Confirm authentication tokens, drafts, queued messages, and server data are not removed by cache or layout reset actions.

## Automated command set

```text
npm run settings:completeness:test
npm run settings:architecture:smoke
npm run settings:account-security:smoke
npm run settings:profile-privacy:smoke
npm run settings:appearance-accessibility:smoke
npm run notifications:preferences:smoke
npm run voice:settings:smoke
npm run keyboard:shortcuts:final:test
npm run settings:advanced-diagnostics:smoke
npm run local-data:migration:smoke
npm run settings:full-mvp:qa
npm run visual:regression:contract
npm run e2e:coverage:contract
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
npm run performance:budget:ci
```

Hardware device enumeration, operating-system startup registration, native notification delivery, and packaged tray behavior still require Windows, Linux, and macOS manual evidence. These are not represented as passed by the local structural gates.
