# Localization QA - English and Turkish

Picom is a desktop-first Electron app for Windows, Linux, and macOS. This QA checklist keeps English and Turkish copy stable without introducing mobile UI or changing the premium desktop layout.

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

## Known gaps

- Full app-wide i18n key extraction is not yet complete.
- Some MVP placeholders may still use English-only copy until the localization pass reaches that surface.
- Turkish date/time formatting depends on the current date/time service coverage.
- Supabase and LiveKit provider errors may still need user-friendly localized mappings.

## Release expectation

Before beta, English and Turkish must be checked on the primary MVP desktop flows. Any hardcoded critical-path copy should either be moved into the localization layer or documented as a temporary MVP exception.
