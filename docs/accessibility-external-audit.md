# External accessibility audit plan

## Status

Prepared, not commissioned/performed. Picom makes no WCAG/EN 301 549/Section 508 conformance or certification claim. Select an independent auditor with Electron desktop and assistive-technology experience; agree exact applicable standard/version with Legal/Product.

## Test matrix

- Windows: keyboard-only, Narrator and one approved additional screen reader; 100/125/150% display scale, high contrast/system themes.
- Linux: keyboard-only, Orca on approved GNOME/Wayland and X11 matrix; desktop theme/scale/portal differences.
- macOS: keyboard navigation/Full Keyboard Access and VoiceOver; permission prompts, zoomed/maximized/custom titlebar behavior.
- Picom light/dark/high-contrast/larger-text/reduced-motion/strong-focus states at 1100x700 and 1440x900.

No mobile/web conformance scope is implied.

## Core journeys

Startup/login/register/legal/onboarding; custom titlebar/search/window buttons; ServerRail community/DM/Home; channel/category/community menus; message list/composer/edit/delete/reaction/reply/attachment/image modal; member search/profile; Mention Feed/stories/comments/right rail; Settings/keyboard shortcuts/help/diagnostics; report/block/moderation/appeal; offline/error/safe mode/crash/update states.

## Audit criteria

- all functions keyboard reachable with logical order, visible focus, no trap and reliable Escape/top-overlay focus restoration;
- semantic roles/names/states/relationships, icon-button labels, live status without excessive announcements and no color-only meaning;
- text/UI/component contrast, focus indicators, disabled/danger/status tokens, 200% text/zoom behavior and no critical clipping/overlap;
- pointer target/usability, hover-only actions keyboard alternative, context menus, draggable titlebar no-drag controls;
- reduced motion, flashing/animation, scroll position and independent pane behavior;
- concise errors with association/recovery; authentication and legal controls understandable;
- images/avatars/attachments/media alternatives and decorative exclusion; user content not inaccurately described.

## Voice and screen share

Verify join/leave, mute/deafen/device/source/start/stop, speaking/connection/reconnect/participant status have labels and non-color state. OS permission denial/revocation/device loss/source cancellation remains keyboard/screen-reader understandable and text chat usable. Source thumbnails/private titles are not copied into evidence unnecessarily; no audio/screen recording is retained.

## Evidence privacy

Use synthetic accounts/content. Evidence records platform/build/theme/scale/AT, steps, expected/actual, severity, screenshot/video reference only when redacted. Exclude credentials, tokens, private messages/attachments, real profiles, screen-source content and unnecessary OS account/path data. Restrict/retain/delete evidence under engagement terms.

## Remediation backlog

| ID | Surface | Standard/criterion | User impact | Severity | Platform/AT | Owner | Target | Fix | Regression test | Retest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A11Y-TBD | pending audit | pending | pending | blocker/high/medium/low | pending | unassigned | pending | pending | pending | pending |

Blocker/high includes inaccessible login/core message send, keyboard trap, hidden critical action/error, unusable screen reader control, dangerous unlabeled action or contrast preventing core use. Fix root cause/system token/component where possible, add automated regression, then require independent retest for blocker/high.

## Exit gate

Scope/standard approved; audit executed on release candidate; all blocker/high fixed and retested; medium has approved owner/date; accessibility statement/support limitations reviewed; evidence archived/deleted correctly; Product/Engineering/Accessibility/Legal sign-off. Until then stable accessibility audit remains incomplete.
