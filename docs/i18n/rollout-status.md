# PICOM 10-language rollout — implementation status

Snapshot of what is built, what is verified, and what remains. Supersedes the planning
assumptions in `localization-expansion.md` (which predates the 10-language registry).

## Supported locales

`en, tr, de, fr, es, it, pt, nl, pl, ru` — registry in
`src/services/localization/uiLanguages.ts`. BCP-47 mapping (`en-US, tr-TR, de-DE, fr-FR,
es-ES, it-IT, pt-BR, nl-NL, pl-PL, ru-RU`) is centralized there and consumed by every
`Intl.*` call, `document.lang`, the Electron locale bridge, and notification formatting.

## Architecture

| Layer | Location | Locales |
|---|---|---|
| Unified runtime (React) | `src/i18n/` — `useTranslation(namespace)` | 10 |
| Namespace resources | `src/i18n/locales/<locale>/<namespace>.json` (16 namespaces) | 10 |
| Settings catalog | `src/services/settings/settingsI18n*.ts` (929 keys) | 10 |
| Live Now catalog | `src/services/localization/liveNowCatalog.ts` | 10 |
| Publisher program catalog | `src/services/localization/publisherProgramCatalog.ts` | 10 |
| Electron main process | `electron/mainLocale.cts` (12 keys) | 10 |

Plural handling uses native `Intl.PluralRules`, so Russian and Polish get real
`one/few/many/other` selection and French/Spanish/Italian/Portuguese get their CLDR `many`
category — no string concatenation anywhere.

### Non-English Settings catalogs are generated

Edit `scripts/settings-i18n-<locale>-partial.mjs`, then run:

```bash
npm run i18n:build-locales
```

`scripts/build-settings-locale.mjs` refuses to emit a catalog with a missing key, a blank
value, an interpolation-token mismatch, or a value accidentally copied verbatim from
English (narrow, commented allowlist for genuine proper nouns).

## Language preference model

`AppearanceSettings` stores two fields:

- `languageMode: "system" | "manual"`
- `language: UiLanguage`

`system` re-resolves the OS locale on every settings read (unsupported → English);
`manual` pins the user's pick. Choosing a language implies `manual`; the
"use system language" toggle switches back to `system`. Both fields persist to
`localStorage` and sync to Supabase `user_settings.preferred_locale` /
`preferred_locale_mode` (migration `20260804000000_user_settings_preferred_locale.sql`,
covered by the table's existing owner-only RLS policies — no policy was weakened and no
service-role path was added). Remote values are always passed through
`normalizeUiLanguage()` before use, so a corrupt row degrades to English instead of
breaking startup. Local preference stays authoritative when Supabase is unreachable.

Local schema version is `11`; migration 10 → 11 preserves any pre-existing stored language
as `manual` so upgrading never silently changes a user's language.

## UI

Settings → Preferences → **Language & Region**
(`src/components/settings/LanguageRegionSection.tsx`) is the sole owner of the language
control — the old Appearance selector was removed, and
`settings-architecture-persistence-smoke.mjs` fails if it reappears. The section provides
search, native + English names, active-selection state, the active BCP-47 tag, and a live
date/time/number/relative-time preview. Changes apply immediately (no restart).

## Verification

```bash
npm run i18n:locale-registry:smoke      # registry, BCP-47, de-AT/pt-PT/nl-BE/... normalization
npm run i18n:catalog-integrity:smoke    # key parity, empties, placeholders, interpolation, plural categories
npm run i18n:electron-bridge:smoke      # main-process catalog anti-drift + IPC wiring
npm run i18n:runtime-behavior:smoke     # ru/pl plural selection, fallback, Intl formatting
npm run settings:architecture:smoke     # locale persistence + Supabase sync contract
npm run i18n:hardcoded-audit            # untranslated user-string backlog (non-zero while work remains)
```

The first three are wired into `scripts/qa-smoke-gate.mjs` (`npm run qa:smoke`). The
hardcoded audit is deliberately **not** gated yet — it currently reports the known
backlog and would block unrelated commits. Add it to the gate once that backlog is zero.

## Remaining work

`npm run i18n:hardcoded-audit` reports **4258 untranslated user-facing strings across 470
files**. This is the real remaining scope: the substrate, tooling, and 10-locale catalogs
for the migrated surfaces are done, but the bulk of screen text still needs extracting.

Breakdown by pattern: JSX text 1954 · `message` props 551 · `aria-label` 502 ·
`label` props 312 · template literals 171 · `title` 160 · `description` 147 ·
toasts 121 · `body` 113 · `placeholder` 80 · remaining calls/props ~150.

Highest-density files: `src/App.tsx` (177), `src/features/companion/CompanionApp.tsx`
(161), `src/services/permissions/communityPermissionCatalog.ts` (110),
`src/components/rootDashboard/modules/UsersPage.tsx` (98).

Admin / Developer Portal / Trust & Safety / audit / Discovery Review surfaces are **in
scope** and are counted in that backlog — none of them are excluded from the audit.

### Audit false-negative limits

The audit is regex-based and knowingly misses: text assembled across variables far from
the render site; strings returned by service layers and rendered verbatim elsewhere; text
inside dynamically-built config maps or arrays not in a recognised user-facing position;
and conditional/nested JSX expressions. An AST-based pass (ts-morph / TS compiler API)
would close these.

## Translation quality

Terminology is fixed per language in `terminology-glossary.md` and reused across
catalogs. `PICOM`, `LiveKit`, `Supabase`, `Electron`, URLs, usernames, community/channel
names, and user content are never translated.

Translations were produced to product-appropriate, natural phrasing (not word-for-word),
but **no native-speaker or professional-translator review has been performed**. Treat
linguistic certification as outstanding.
