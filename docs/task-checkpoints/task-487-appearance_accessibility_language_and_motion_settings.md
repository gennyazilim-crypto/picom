# Task 487 - Appearance, Accessibility, Language, and Motion Settings

Date: 2026-07-11

## Outcome

Picom settings schema v8 now stores device-local System/Light/Dark theme preference, English/Turkish language, comfortable/compact density, system/numeric/descriptive date style, and system/12-hour/24-hour time format. Existing high contrast, reduced motion, larger text, and strong focus ring settings remain centralized.

## Runtime behavior

- A pre-React bootstrap applies resolved theme, theme preference, language, density, date/time mode, and accessibility data attributes to prevent avoidable startup flash.
- System theme follows prefers-color-scheme at startup and while the renderer is open.
- appearanceService owns root state; dateTimeService owns locale/date/time output; localizationService owns typed Picom-controlled TR/EN catalog copy.
- Settings navigation and Appearance controls switch immediately between English and Turkish.
- User-generated messages, names, profiles, communities, and moderation evidence are never translated automatically.
- Compact density changes desktop spacing only; it does not add a small-screen or mobile layout.

## Validation

- npm run settings:appearance-accessibility:smoke: PASS
- npm run settings:architecture:smoke: PASS
- npm run settings:completeness:test: PASS
- npm run accessibility:display:smoke: PASS
- npm run accessibility:external-audit:smoke: PASS structural
- npm run date-time:smoke: PASS
- npm run localization:expansion:smoke: PASS
- npm run localization:qa:smoke: PASS
- npm run startup:performance:audit: PASS structural
- npm run first-launch:smoke: PASS
- npm run visual:regression:contract: PASS coverage contract
- npm run desktop:smoke: PASS
- npm run typecheck: PASS
- npm run mock:smoke: PASS
- npm run build: PASS
- npm run qa:smoke: PASS
- npm run performance:budget:ci: PASS hard caps

The requested command startup:performance:final:smoke does not exist. The repository-approved startup:performance:audit command was run instead.

The working-tree accessibility remediation run is BLOCKED by pre-existing, unstaged user-owned AppIcon/Iconix changes. The committed HEAD AppIcon accessibility contract contains aria-hidden and focusable=false and passes the same marker check; AppIcon was not modified or staged by this task.

Performance warnings remain below hard caps: initial JS 1590.1 KiB, initial CSS 230.2 KiB, and total assets 3102.0 KiB. The existing voiceService static/dynamic import warning is unrelated.

## External evidence

Real Windows Narrator, Linux Orca, macOS VoiceOver, keyboard-only platform runs, measured contrast evidence, and packaged cold-start theme capture remain BLOCKED because those external/manual environments were not executed. Structural contracts pass, but no formal WCAG or platform conformance claim is made.

The typed catalog now provides the runtime and completed Settings/Appearance TR/EN surface. Additional legacy Picom-owned copy can migrate to the same catalog without changing user-generated content.
