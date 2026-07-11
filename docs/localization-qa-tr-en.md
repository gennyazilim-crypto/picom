# Localization QA - English and Turkish

Picom is a desktop-first Electron app for Windows, Linux, and macOS. This QA checklist keeps English and Turkish copy stable without introducing mobile UI or changing the premium desktop layout.

## Current implementation status

Picom now has a typed central runtime message catalog and an English/Turkish language selector. Settings > Appearance is fully catalog-backed, document language and locale-sensitive dates use `appearanceService` plus `dateTimeService`, and remaining Picom-owned legacy strings follow the same catalog/review plan. Existing Turkish product labels must remain valid UTF-8; English fallback is explicit rather than presented as translated copy.

## Scope

- Languages: English (`en`) and Turkish (`tr`).
- Platforms: Windows, Linux, and macOS desktop.
- UI direction: Picom visual identity, Coolicons/AppIcon icons, design tokens, no Discord branding or exact colors.
- User-generated content must not be translated automatically.

## Core surfaces to verify

- Login and register screens.
- Electron custom titlebar.
- ServerRail tooltips and actions.
- CommunitySidebar community header, category labels, and channel states.
- ChatHeader actions, search placeholder, and connection/status copy.
- MessageList empty states, timestamps, reactions, replies, and attachment labels.
- MessageComposer placeholder, upload states, permission states, and send errors.
- MemberSidebar groups, search placeholder, member roles, and empty search state.
- SettingsModal navigation and section descriptions.
- DesktopContextMenu labels.
- UserProfilePopover and full profile view labels.
- ImagePreviewModal actions and error states.
- Mention Feed tabs: `Feed` and `Takip Ettiğin Kişiler`.
- Toasts, blocking errors, safe mode, diagnostics, and crash screen copy.

## Turkish layout checks

- Longer Turkish labels must truncate or wrap without causing horizontal overflow.
- Mention Feed tab labels use a dedicated truncating text span while their count remains visible.
- Sidebar labels must stay inside fixed desktop columns.
- Buttons should not grow enough to break modal layouts.
- Titlebar actions and search input must remain clickable and not overlap window controls.
- Context menus and popovers must stay inside the viewport.
- Date/time strings must use locale-aware formatting where implemented.

## English layout checks

- English labels should remain concise and desktop-native.
- Empty states should explain the next action without sounding mobile/social-first.
- Error messages should avoid raw developer stack traces for normal users.
- Diagnostics can include technical details only in clearly marked developer/support areas.

## Copy rules

- Use Picom terminology consistently: communities, channels, members, mentions, profile, settings.
- Do not use Discord-specific product names, labels, logo language, or exact color names.
- Avoid final legal/compliance claims unless reviewed.
- Prefer clear placeholders for incomplete production systems.
- Keep Turkish copy natural and concise, not word-for-word mechanical translation.
- Never translate user-generated messages, community/channel names, profile bios, status text, attachment captions, or moderation evidence automatically.

## UTF-8 and future-locale checks

- Source, scripts, packaged assets, diagnostics, and support exports must preserve UTF-8; reject replacement glyphs or mojibake sequences.
- Use BCP 47 locale tags and the approved deterministic English fallback for every new catalog key.
- A future pseudo-locale should expand labels by 30-40% and preserve interpolation markers without changing user content.
- Turkish casing must not be implemented with English-only string assumptions; search/collation behavior needs locale-specific product approval before changing identifiers.
- Legal, safety, consent, deletion, and moderation copy requires human translation and version-level review; machine output is not production approval.

## Manual QA pass

1. Start the app in mock mode.
2. Verify the login/register or restored session screen in English.
3. Switch to the main shell and test the four-column layout at 1440x900.
4. Open Settings and verify all visible labels remain inside modal bounds.
5. Toggle dark mode and repeat the same screens.
6. Switch any available language/localization setting to Turkish if exposed.
7. Verify Turkish labels in titlebar, sidebars, composer, modals, context menus, toasts, and empty states.
8. Search members with a long Turkish query and confirm no sidebar overflow.
9. Open message/profile/image overlays and confirm Escape closes the topmost overlay.
10. Confirm no mobile navigation or web-first responsive replacement appears.
11. Restart with Windows/Linux/macOS locale set to `tr-TR`, then `en-US`, and verify message, notification, audit, event, and session timestamps change through `Intl` without changing stored content.
12. Exercise deliberately long Turkish labels at 1100x700 and confirm ellipsis/wrapping preserves every critical action and count.

## Known gaps

- Full app-wide i18n key extraction and a runtime language selector are not approved or complete.
- Some MVP placeholders may still use English-only copy until the localization pass reaches that surface.
- Turkish date/time formatting depends on the current date/time service coverage.
- Supabase and LiveKit provider errors may still need user-friendly localized mappings.

## Release expectation

Before a localized release, English and Turkish must be checked on the primary desktop flows. Any hardcoded critical-path copy must be moved into the approved localization layer or recorded in a temporary exception register with owner and target release. Current beta copy remains English-first with selected reviewed Turkish product labels.
