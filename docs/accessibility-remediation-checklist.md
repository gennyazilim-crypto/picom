# Accessibility Remediation Checklist

## Status and scope

This is an internal structural remediation pass for Picom's Windows, Linux and macOS Electron client. **No conformance claim** is made for WCAG, EN 301 549 or Section 508. Independent assistive-technology and contrast certification remains required before a stable accessibility claim.

## Remediated foundations

- Blocking dialogs use the shared topmost-dialog focus trap.
- Tab and Shift+Tab remain within the active blocking dialog.
- Escape closes the topmost closable dialog; busy destructive/submission dialogs retain their close guard.
- Closing a dialog restores focus to the element that opened it where practical.
- Dialogs provide an accessible name and key creation/moderation/feedback surfaces include an associated description.
- Icon-only controls retain explicit `aria-label` values; decorative `AppIcon` SVGs are hidden and never keyboard-focusable.
- Global focus-visible, strong-focus and high-contrast token paths remain active in light and dark themes.
- Error/status copy uses alert/status semantics on remediated core flows.

## Keyboard-only manual pass

- [ ] **Keyboard-only:** traverse login, onboarding, titlebar, ServerRail, community/channel navigation, composer and Settings without a pointer.
- [ ] Open create community, create/edit/delete channel, invite, poll, story viewer, member moderation, report, feedback and Developer Portal dialogs.
- [ ] Confirm initial focus is visible and meaningful.
- [ ] Confirm Tab/Shift+Tab wraps inside only the topmost blocking dialog.
- [ ] Confirm Escape closes the topmost dialog and focus returns to its opener.
- [ ] Confirm nested/non-blocking popovers do not steal or permanently trap focus.
- [ ] Confirm all hover-only message/member actions have keyboard-reachable alternatives.

## Screen reader matrix

- [ ] **Windows Narrator:** names, roles, descriptions, checked/pressed states, errors and modal boundaries.
- [ ] **Linux Orca:** the same core journeys on the approved GNOME/Wayland and X11 matrix.
- [ ] **macOS VoiceOver:** the same core journeys with Full Keyboard Access enabled.
- [ ] Verify decorative icons and avatars do not create duplicate announcements.
- [ ] Verify live connection, upload, send, notification and moderation states are concise and not repeatedly announced.

## Contrast and display

- [ ] **Contrast:** measure text, muted text, borders, controls, status/danger/success tokens and focus indicators in light, dark and high-contrast modes.
- [ ] Verify 100%, 125% and 150% display scale at 1100x700 and 1440x900.
- [ ] Verify larger text does not hide critical labels/actions or create horizontal app-frame overflow.
- [ ] Verify reduced motion suppresses non-essential animation without removing state feedback.
- [ ] Verify focus indicators remain visible against normal, hover, active and danger surfaces.

## Modal and destructive-action checks

- [ ] Close buttons have accessible names and remain reachable.
- [ ] Alert dialogs announce their title and consequence before the destructive action.
- [ ] Busy operations cannot be accidentally dismissed if doing so would obscure the result.
- [ ] Validation errors are announced and identify the recovery action.
- [ ] Focus never moves behind an active blocking modal.

## Exit criteria

- Structural smoke passes.
- No blocker/high keyboard or screen-reader issue remains in core login/community/message flows.
- Contrast measurements are recorded against the agreed standard/version.
- Windows Narrator, Linux Orca and macOS VoiceOver results are attached using synthetic data only.
- Independent audit findings are tracked and retested; this internal checklist alone is not certification.

