# Picom localization expansion plan

## Current status

Picom does not currently have a centralized i18n runtime, typed translation catalog, locale setting, or English/Turkish key parity check. The renderer contains hardcoded English user-facing strings. `dateTimeService` correctly uses native `Intl` and defaults to the operating-system/browser locale, but its invalid-date fallbacks and surrounding labels are hardcoded English and it is not connected to an explicit Picom language preference.

No production UI strings were migrated in Task 109. Introducing a partial translation layer without key coverage/fallback tests would produce mixed-language screens and regress the stable desktop UI.

## Supported and future locales

### Initial supported pair

- `en`: source/default language and required fallback.
- `tr`: complete Turkish product translation for the approved core surfaces.

### Future locales

Add only after the architecture supports locale metadata, plural/number/date formatting, key parity, fallback, truncation testing, legal review, and translator QA. Candidate locales are a product/market decision, not a code default.

Language tags should follow BCP 47 where specificity matters (`en`, `tr`, later `de`, `ar`, `pt-BR`, etc.). Do not infer a user's country, legal region, or content language only from UI locale.

## Static inventory findings

An approximate JSX text scan found the highest hardcoded-string concentrations:

| Surface/file | Approximate literal count | Priority |
|---|---:|---|
| `SettingsModal.tsx` | 199 | P0 core/settings/legal/account |
| `AdminOperationsPanel.tsx` | 30 | P2 restricted/admin |
| `CommunityMenu.tsx` | 29 | P0 role/community actions |
| `community/CommunityAdminSections.tsx` | 29 | P1 owner/admin |
| `DeveloperPortalView.tsx` | 25 | P3 disabled/restricted |
| `CommunityEventsAdminSection.tsx` | 22 | P1 events |
| `ProfileView.tsx` | 20 | P0 profile |
| `settings/DiagnosticsSection.tsx` | 17 | P1 diagnostics/support |
| Bot/audit/webhook admin sections | 15-16 each | P3 post-MVP/restricted |
| `VoiceRoomView.tsx` | 13 | P0 voice controls/errors |
| `MessageItem.tsx` | 11 | P0 chat |
| `RegisterScreen.tsx` / `LoginScreen.tsx` | 9-10 | P0 auth |
| Direct Messages / Friends / Saved / Feed panels | 7-13 | P1 social/navigation |

The count is a prioritization signal, not a complete localization audit. It misses string interpolation, arrays/config objects, service error messages, toasts, aria labels, placeholders, document data, Electron main/preload messages, and strings split across JSX.

## Critical hardcoded surfaces

### P0: must migrate as complete user flows

1. Startup/error/safe-mode/maintenance/version compatibility.
2. Login, registration, password reset, legal acceptance, onboarding, logout/session expired.
3. WindowTitleBar, ServerRail tooltips, CommunitySidebar, channel types/states, UserMiniCard.
4. ChatHeader, MessageList/Item, composer, upload progress/failure, reactions/replies, permissions, offline/realtime state.
5. MemberSidebar/search/profile popover and full Profile.
6. Mention Feed tabs/cards/footer/stories/right rail/open-in-channel states.
7. Settings Account/Profile/Privacy/Appearance/Notifications/Voice/Keyboard/Diagnostics/Legal/Advanced.
8. Context menus, blocking confirmations, toasts, empty/error states, network and voice controls.

Do not migrate one button in a flow while leaving its modal/errors/aria labels in English.

### P1

- Communities/channels create/edit/delete and join/leave/invite.
- Direct messages/friends/saved messages/search.
- Events, reports/moderation, audit viewer, diagnostics/log export.
- Desktop tray/menu/native notifications/protocol errors.

### P2/P3

- App-admin/trust-and-safety/discovery review.
- Developer/bot/webhook/plugin placeholders while disabled/restricted.
- Operational/developer-only commands, provided they remain English-only by documented scope until enabled.

## Proposed architecture

### Catalogs and typed keys

Recommended structure:

```text
src/i18n/
  config.ts
  localeService.ts
  types.ts
  catalogs/
    en.ts
    tr.ts
```

Use English catalog keys as a typed source of truth, not raw English sentences as keys:

```ts
export const en = {
  auth: {
    login: {
      title: "Sign in",
      emailLabel: "Email",
      submit: "Sign in",
    },
  },
} as const;

export type MessageKey = LeafKey<typeof en>;
```

Turkish must satisfy the same structure at compile/test time. Support typed interpolation and plural/select values without permitting raw HTML. User-generated content, usernames, channel/community names, message bodies, filenames, bios, and custom status text are never translated.

### Runtime behavior

- Language preference: `system | en | tr` stored in `settingsService` and local migration registry.
- `system` resolves from Electron renderer/system locale; normalize unsupported variants to `en` fallback.
- Locale change updates React labels without restart where practical.
- Missing Turkish key falls back to English and emits a development-only, content-free warning; release key parity should prevent this.
- No network translation provider or runtime remote code/catalog loading.
- Services return typed error codes/data, not final English UI strings; UI formats them through catalogs.
- Electron main/preload errors use stable codes; renderer translates safe messages.

Avoid a heavy i18n dependency until plural/formatting needs justify it. If a library is selected, review bundle size, CSP, Electron behavior, ICU support, license, and TypeScript key safety.

## Dates, times, numbers, and relative labels

Keep native `Intl` as the formatting engine:

- `Intl.DateTimeFormat` for message/full/audit/event timestamps.
- `Intl.RelativeTimeFormat` for notification/feed relative labels.
- `Intl.NumberFormat` for counts, compact counts, file sizes where appropriate.
- `Intl.ListFormat` for participant/member summaries if used.
- System timezone by default; explicit user timezone only after a real setting exists.

`dateTimeService` should accept the resolved Picom locale from `localeService` rather than reading `navigator.language` independently. Invalid/missing value should return a translation key/result (`common.date.invalid`) rather than hardcoded `Invalid date`. Event-range punctuation must use `Intl.DateTimeFormat.formatRange()` where supported, with a locale-aware fallback.

Do not translate stored timestamps, IDs, or user content. Test DST transitions, 12/24-hour OS preferences, Turkish month names, and system timezone changes after sleep/resume.

## Turkish-specific QA

Turkish strings can be materially longer than English and contain `ç, ğ, ı, İ, ö, ş, ü`. Requirements:

- UTF-8 source/build/package/diagnostic handling; no mojibake (`Â`, `Ä`, replacement glyphs).
- Locale-aware casing: avoid JavaScript `toUpperCase()` for visible Turkish labels when casing matters; use CSS cautiously or `toLocaleUpperCase('tr')`.
- Search normalization must not incorrectly equate/split dotted and dotless I; user-generated search semantics need separate product decisions.
- Buttons use min-width/content wrapping or safe truncation only when full text is available via accessible name/tooltip.
- Sidebar/channel/member rows remain one-line ellipsis where identity/navigation density requires it.
- Modal headings, confirmation warnings, Settings tabs, tray menu, voice controls, and empty states must not clip.
- Test 110%, 125%, 150%, and 200% text/display scaling at the 1100x700 minimum window and 1440x900 target.

Representative expansion fixtures should include long Turkish labels such as:

- `Bildirim tercihlerini yönet`
- `Topluluk ayarlarını düzenle`
- `Hesabın silinmesini talep et`
- `Takip ettiğin kişiler`
- `Bu topluluğa katılarak mesaj gönder`

Fixtures are QA strings, not approved translations.

## Legal document localization

Legal policies are versioned acceptance documents, not ordinary UI copy.

- Qualified counsel approves each language/version and determines language precedence.
- Store immutable policy version plus locale; preserve the exact accepted rendered text outside the user profile event.
- Do not machine-translate Terms, Privacy, Community Guidelines, Acceptable Use, consent, age, rights, retention, or appeal language and publish it without legal review.
- Registration/re-acceptance links must show the locale/version the user accepts.
- If a legally approved Turkish version is unavailable, product/legal decides whether launch is blocked or English is presented with explicit precedence/availability notice.
- Changing translation meaning may require a new acceptance version even when English source version is unchanged.

## Accessibility and screen readers

- Translate visible text, aria labels/descriptions, title/tooltips, status/live-region messages, error help, and keyboard shortcut descriptions together.
- Do not concatenate translated fragments; use complete parameterized messages so Turkish grammar can reorder terms.
- Preserve semantic roles and focus behavior independent of locale.
- Screen reader language should follow `<html lang>` and update on locale change.
- User-generated content remains in its authored language; do not force an incorrect `lang` unless language metadata is known.

## RTL future readiness

English/Turkish are LTR. Future Arabic/Hebrew/Persian/Urdu requires a dedicated scope and visual/accessibility QA:

- Set `dir="rtl"` at document/app root for RTL locale.
- Replace physical CSS (`left/right`, margin-left) with logical properties where safe.
- Mirror navigation chevrons/directional icons but not universal media/playback or brand artwork without design review.
- Test custom titlebar drag/controls, ServerRail, sidebars, message grouping, composer, context menu bounds, attachment layouts, charts/status, keyboard arrows, and screen share.
- Keep code/URLs/emails/usernames/IDs in appropriate bidi isolation (`bdi`, `dir="auto"`).
- Guard against bidi control spoofing in filenames, links, usernames, and logs.

Do not claim RTL support until dedicated visual and assistive-technology certification passes.

## Migration phases

### Phase 0: foundation

1. Add typed catalogs, locale resolution, English fallback, key-parity test, and `<html lang>` update.
2. Add `language` to settings schema/local migration.
3. Connect `dateTimeService` and error formatter.
4. Add development missing-key reporting without content/secrets.

### Phase 1: core entry and shell

Migrate startup/auth/legal acceptance/onboarding and titlebar/rail/sidebar. Complete English/Turkish QA before proceeding.

### Phase 2: core chat

Migrate ChatHeader, messages, composer/upload/reaction/reply, member sidebar, empty/error/permission/network/realtime states.

### Phase 3: feed/profile/settings

Migrate Mention Feed/stories/companion rail, Profile, Settings, context menus, notifications, diagnostics, and legal links (not legal body until approved).

### Phase 4: extended/restricted surfaces

Communities/admin/moderation/events/search/DM/friends/saved, then restricted post-MVP/admin/developer surfaces only when shipping.

### Phase 5: legal and release certification

Import counsel-approved localized legal documents with immutable versions; run Windows/Linux/macOS packaging, screenshots, keyboard/screen reader, Turkish overflow, pseudo-localization, date/time, and fallback tests.

## Tests and CI gates

- English/Turkish key parity; no missing/extra keys.
- Placeholder variable parity and type checks.
- No unsafe HTML in translations.
- Disallow obvious hardcoded user strings in migrated directories with an allowlist for user data/technical constants.
- Pseudo-locale expands text 30-50%, adds diacritics, and exposes concatenation/clipping.
- Snapshot/visual tests at 1440x900 and 1100x700, light/dark, English/Turkish, reduced motion.
- Locale-aware date/relative/number unit tests with fixed timestamps/timezones.
- Packaged Electron smoke per OS; verify menus/tray/native notifications where localized.
- NVDA/VoiceOver/Orca accessible-name check for critical flows.
- Legal locale/version acceptance staging test.

## Release blockers

- Mixed English/Turkish in a migrated P0 flow.
- Missing key or interpolation shown to users.
- Mojibake or broken Turkish casing.
- Button/sidebar/modal clipping that hides the action/confirmation.
- Date/time shown in wrong locale/timezone or invalid fallback exposed.
- Aria label disagrees with visible translated action/state.
- Unapproved localized legal text or acceptance version mismatch.
- User-generated content altered/translated.

## Decision

The current application remains English-only with system-locale date formatting. Localization expansion is ready as a staged engineering/product/legal program, but English/Turkish support is not claimed until the typed foundation and complete P0/P1 flow migration are implemented and certified.
