# Picom desktop accessibility audit

**Standard:** WCAG 2.2 Level AA (with selected usability/AAA observations)  
**Audit date:** 2026-07-10  
**Scope:** Electron desktop app for Windows, Linux, and macOS; static code/design-token review plus targeted safe fixes  
**Not performed:** automated browser accessibility engine, packaged-app keyboard session, NVDA/VoiceOver/Orca session, color measurement of every state, 200% zoom/DPI run

## Executive summary

Picom has a useful accessibility foundation: semantic native buttons/inputs are common, form labels are present, icon-only controls usually have `aria-label`, focus tokens exist, reduced-motion CSS exists for key surfaces, errors/statuses use alert/status roles in several core flows, and content images generally have alt text.

This audit found no confirmed critical blocker from static inspection. It found **4 major/open themes** and **5 moderate/minor themes** requiring real packaged-app testing. Small fixes applied in this task improve blocking modal focus, context-menu keyboard semantics, profile popover focus, image-preview naming, light-theme muted contrast, and focus rings for selects/links.

Passing TypeScript/build proves code integrity, not WCAG conformance. Public release still needs keyboard-only and assistive-technology evidence on the supported desktop platforms.

## Findings

| ID | Area | WCAG | Severity | Status | Finding / action |
|---|---|---|---|---|---|
| A11Y-01 | Light muted text contrast | 1.4.3 | Major | Fixed | `#7a8899` on white was about 3.6:1 and was used for small text. Light `--text-muted` changed to `#607084` (about 4.6:1 on white and intended to remain near/above AA on soft surfaces). Measure all actual blended states in packaged light mode. |
| A11Y-02 | Blocking modal focus | 2.1.1, 2.4.3, 2.4.11, 4.1.2 | Major | Partially fixed | Settings, Legal Document, and Image Preview now receive focus, trap Tab/Shift+Tab, close on Escape, and restore previous focus. Inventory and migrate every other blocking modal (reports, community/admin, onboarding dialogs, story viewer, feedback, command palette where modal) to the same behavior. |
| A11Y-03 | Context menu/popover keyboard | 2.1.1, 2.4.3, 4.1.2 | Major | Partially fixed | DesktopContextMenu now exposes `menu/menuitem`, autofocus, Arrow Up/Down, Home/End, Escape, and focus restoration. Profile popover is named and focuses/restores actions. Verify menu triggers are keyboard-openable and other popovers have equivalent semantics. |
| A11Y-04 | Dynamic announcements | 4.1.3 | Major | Open | Login/register errors and several composer states use `alert`/`status`, but message send result, realtime reconnect, typing, unread changes, uploads, voice join/speaking, toasts, and route/view changes do not have one verified announcement strategy. Add polite/assertive live regions based on urgency without chat spam. |
| A11Y-05 | Reduced motion coverage | 2.3.3 | Moderate | Open | `prefers-reduced-motion` disables several server/channel/message/attachment/profile/story transitions. The user reduced-motion setting and every modal/popover/loading/gradient animation need a complete mapping and packaged verification. No essential information may depend on motion. |
| A11Y-06 | Form error association | 3.3.1, 3.3.2, 3.3.3 | Moderate | Open | Login/register fields have visible labels and page-level alerts. Add stable field IDs plus `aria-describedby`/`aria-invalid` for field-specific errors, password requirements, account deletion confirmation, invite/upload validation, and settings failures. Focus the first invalid field after submit. |
| A11Y-07 | Voice state semantics | 1.3.1, 4.1.2, 4.1.3 | Moderate | Open | Join/mute/deafen use native buttons and `aria-pressed` for toggles. Speaking, connection-quality, participant mute, screen-share start/stop, device errors, and reconnect state require text equivalents and carefully throttled live announcements. Test permission denial with screen reader. |
| A11Y-08 | Feed/profile structure | 1.3.1, 2.4.6 | Moderate | Open | Mention cards use articles, buttons, alt text, and optional headings; Profile has labeled main/aside/sections and button-wrapped media. Verify a logical heading hierarchy when mention title is absent, give feed sections programmatic headings, and announce navigation/open-in-channel context. |
| A11Y-09 | Compact target size | 2.5.8; 2.5.5 advisory | Minor/moderate | Open | Several desktop icon controls are 28–34px. WCAG 2.2 AA target-size exceptions may apply when spacing is sufficient, but test motor accessibility and ensure at least 24x24 target/spacing; prefer larger targets for primary/danger/voice actions without redesigning desktop density. |
| A11Y-10 | High contrast/system modes | 1.4.11 | Moderate | Open | High-contrast tokens exist as a path, but Windows forced-colors, Linux high-contrast themes, macOS Increase Contrast, focus non-text contrast, status dots, selected chips, and disabled controls were not measured. Add `forced-colors` QA and never rely on color alone. |

## Safe fixes applied

### Blocking dialogs

`useDialogFocusTrap` now:

- records the previously focused element
- moves focus to the first enabled control (or dialog container)
- loops Tab and Shift+Tab inside the active dialog
- closes on Escape
- restores focus after close

Applied to Settings, Legal Document, and Image Preview. Their dialog roles, modal state, accessible names, and focusable containers are explicit.

### Context menu

- `role="menu"` and `role="menuitem"`
- native buttons with explicit `type="button"`
- Arrow Up/Down wrapping
- Home/End
- Escape
- initial focus and trigger focus restoration

### Profile preview

The non-blocking profile preview has a descriptive dialog label, focuses its first action, restores trigger focus, and hides decorative cover/status-dot graphics from screen readers while preserving textual status.

### Focus and contrast tokens

- Global focus-visible selector now includes `select`, links, and explicit tabindex targets.
- Light muted text changed to `#607084`; all final blended/component states still require automated measurement.

## Area audit

### Keyboard navigation

Strengths:

- Core interactions generally use native buttons, inputs, textarea, and select.
- Escape handlers exist on key overlays.
- Message composer supports Enter send and Shift+Enter newline.
- Current focus ring is tokenized and visible in common controls.

Gaps/manual tests:

1. Tab from custom titlebar through ServerRail, CommunitySidebar, header, message list actions, composer, and MemberSidebar without traps/skips.
2. Community/channel/member/message context menu opening through keyboard, not only right click.
3. Command palette arrow/Enter/Escape and focus restoration.
4. Story viewer previous/next/close; feed filters/tabs; Profile Back and media.
5. Overlay stack: only topmost layer receives Escape/Tab and parent focus resumes after nested modal.
6. Window controls retain correct no-drag click and keyboard behavior.

### Focus indicators

Focus-visible uses `--focus-ring` for native controls and selected custom controls. Verify ring contrast at 3:1 against adjacent light/dark/high-contrast surfaces, clipping within rounded/overflow containers, and visibility on danger/accent backgrounds.

### Icon accessible names

Core icon-only controls inspected in composer, feed, profile, settings, image preview, and titlebar patterns generally have labels. Continue enforcing:

- icon-only button: explicit, state-aware `aria-label`
- text+icon button: icon decorative/hidden; button text is the name
- toggle: `aria-pressed` or native checkbox plus state in accessible name
- decorative status/cover/icon: hidden from accessibility tree

Add a static lint/test for `<button>` containing only `AppIcon` without an accessible name; static grep is not sufficient.

### Modal focus and overlay order

The three fixed blocking dialogs now meet the core focus pattern. Remaining overlay inventory must be tested/migrated. Nested Legal modal opened above re-accept/settings must prevent the parent trap from competing; this requires live keyboard verification and possibly central overlay ownership/inert background management.

Background content is not yet proven `inert`/`aria-hidden` while every modal is open. Add this before claiming full 2.4.3/4.1.2 coverage.

### Color contrast

Known token observations:

- Light primary/secondary text is visually strong.
- Light muted token was insufficient for normal small text and was darkened.
- Dark primary/secondary/muted pairs appear stronger but require tool measurement on every actual surface/blend.
- Accent, warning, danger, success, disabled opacity, badges, selected states, charts/status dots, and text over story/media gradients require state-by-state measurement.

Use an automated contrast tool on computed colors; `color-mix()`, opacity, gradients, and image overlays cannot be certified from base tokens alone.

### Reduced motion

CSS covers several major hover/transition groups. Test both OS `prefers-reduced-motion` and Picom's persisted setting. Disable/reduce non-essential story zoom, modal/popover entrance, loading decoration, smooth scroll, animated gradients, voice speaking pulses, and connection indicators while retaining immediate state clarity.

### Login and registration

Strengths:

- Labeled native fields and appropriate autocomplete values.
- Visible errors use `role="alert"`.
- Terms checkbox is native and policy links are buttons.
- Decorative hero/logo is hidden/empty alt.

Gaps:

- Field-specific error association and invalid focus.
- Password requirement/help announcement.
- Loading state should expose `aria-busy` and prevent duplicate submission without removing context.
- Social login disabled/coming-soon states need clear accessible explanation.

### Message composer

Strengths:

- Labeled composer region and controls.
- Attach/emoji/GIF/sticker/poll/cancel/retry/remove actions have names.
- Permission hint uses status role.
- Upload images have alt text and progress is visually represented.

Gaps:

- Progress requires `progressbar` semantics (`aria-valuenow/min/max`) and completion/failure announcements.
- Emoji/sticker pickers require grid/listbox keyboard behavior and focus return.
- Sending/queued/failed/retry states need restrained live announcements.
- Typing text and character/slow-mode state need accessible status without continuous spam.

### Mention Feed cards

Strengths:

- Semantic article, native profile/action buttons, accessible image paths, visible unread text, no unsafe HTML rendering.

Gaps:

- Ensure every article has a programmatic heading or labelled-by author/context.
- Reaction buttons need pressed state and emoji accessible names/counts.
- Comment avatar stack needs a concise text summary rather than repeated decorative image names.
- Story cards/carousel need region label, position/set-size, and keyboard scroll/navigation.

### Profile view

Strengths:

- Main/aside/section labels, native action buttons, media alt text, disabled video placeholders.

Gaps:

- Heading hierarchy and route/view announcement.
- Follow/friend state uses `aria-pressed` or status announcement.
- Role/status tags must not rely only on color.
- Gallery should expose item position and modal focus return.

### Voice controls

Strengths:

- Text labels accompany icons.
- Mute/deafen expose pressed state.
- Voice room has a programmatic label and device selects have labels.

Gaps:

- Connection, speaking, screen share, participant mute/deafen, quality, and error state semantics/live regions.
- Keyboard and screen-reader test of device permission prompts (outside renderer control).
- Deafen implications should be stated, not only toggled.
- Never use pulsing/color alone for speaking/connection.

## Required manual certification matrix

### Windows

- NVDA with keyboard only.
- Windows High Contrast/forced colors.
- 100%, 125%, 150%, 200% display/text scaling.
- Reduced motion and keyboard shortcuts.

### macOS

- VoiceOver keyboard navigation.
- Increase Contrast, Reduce Motion, Reduce Transparency.
- Screen-recording/microphone permission denial and recovery.

### Linux

- Orca with a supported desktop environment.
- High-contrast theme and 125%/150% scaling where available.
- Keyboard focus through native Electron chrome replacements.

For each: login/register, re-accept/onboarding, community/channel, message composer/upload, feed/story, Profile, settings/legal/image modal, context menu, voice/screen share, error/offline states.

## Release blockers

- Core flow cannot be completed keyboard-only.
- Focus escapes behind a blocking modal or is lost after close.
- Screen reader cannot identify login/register/composer/window/voice controls.
- Normal body/error text fails AA contrast without an approved large-text exception.
- Private/security/destructive action is ambiguous to assistive technology.
- Motion cannot be reduced where it risks discomfort.
- Auth/upload/message errors are invisible to assistive technology.

## Recommended next actions

1. Add automated axe-style packaged renderer scan for stable mock views.
2. Inventory every overlay and adopt one central focus/inert pattern.
3. Run computed contrast tests for every theme/state token combination.
4. Add live-region strategy for toasts, network, message, upload, and voice state.
5. Add ARIA patterns/tests for emoji picker, stories, reactions, command palette, and feed tabs.
6. Complete NVDA/VoiceOver/Orca and forced-colors certification before stable release.

## Audit conclusion

Picom's foundation is promising and the small fixes reduce obvious desktop blockers, but **WCAG 2.2 AA conformance is not yet claimed**. Remaining manual assistive-technology, overlay, contrast, dynamic announcement, and high-contrast evidence is release work.
