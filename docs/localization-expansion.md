# Localization expansion plan

## Status and decision

Expansion beyond English/Turkish is not approved. Picom currently has no complete central message catalog/runtime, while `dateTimeService` correctly uses `Intl` and system locale by default. Do not add a language selector or claim full EN/TR coverage until core strings are extracted and tested.

## Target architecture

- canonical English source keys grouped by desktop surface/domain, stable semantic IDs rather than source text;
- locale metadata registry: BCP 47 tag, display name, direction, fallback, status (`development`, `review`, `published`) and reviewer;
- typed `t(key, values)` plus plural/select/number/date/list formatting through standards-based Intl/ICU-compatible messages;
- lazy catalog loading only after bundle/performance review, deterministic English fallback and visible missing-key diagnostics in development only;
- user language persisted separately from auth secrets; `system` follows `navigator.languages` and updates date/time labels;
- user-generated community/channel/profile/message content is never translated automatically.

No arbitrary HTML in translations. Interpolation values are escaped React text, placeholders are validated, unknown keys fail safely, and catalogs cannot define icons, links/protocols, CSS, code or native actions.

## Extraction phases

1. Inventory hardcoded strings and define key naming/lint/missing-key report.
2. Extract auth/startup/error/desktop shell/navigation/chat/composer/settings/modals/context menus/notifications/help/safety/legal link labels without changing layout.
3. Complete human-reviewed English and Turkish parity; locale-switch smoke and fallback.
4. Add `en-XA` pseudo-locale with 30-40% expansion and `ar-XB`/RTL research only after RTL layout scope approval.
5. Approve one new locale from user/support demand, translator availability, legal/support coverage and platform QA.
6. Roll out internal/beta per locale with rollback to English catalog.

## Legal and safety text

Machine translation may be used only as a clearly marked internal draft aid. Terms, Privacy, Community Guidelines, Acceptable Use, consent, moderation reason/appeal, data-rights, security/update and payment text require qualified human translation plus Legal/Product approval for exact version/hash/effective date. A translated legal document never silently falls back to different-version English at acceptance time.

## Desktop overflow QA

Test Windows/Linux/macOS at 1100x700 and 1440x900, 100/125/150% scaling, light/dark/high contrast/larger text/reduced motion. Verify custom titlebar search/controls, 72px ServerRail tooltips, 260px community sidebar, 280px member sidebar, channel/member truncation, composer, Settings 900x650, menus/popovers, report/legal/onboarding/profile/feed/voice and buttons. Text truncates with accessible title where appropriate; critical actions/errors wrap and remain visible. No mobile breakpoint/navigation is introduced.

Automated checks should reject missing/extra placeholders, malformed messages, raw HTML, empty values, key drift and unreviewed legal status. Visual snapshots use pseudo-locale and fixed desktop viewport; manual keyboard/screen-reader review remains required.

## Date/time/number rules

Use `dateTimeService`/`Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`, system timezone by default and explicit event timezone where needed. Never concatenate translated date fragments or hardcode English/Turkish month/relative strings. Number/plural/list formatting uses selected locale; stored timestamps remain UTC/ISO.

## Approval gate

Named localization owner, selected runtime/dependency/license/bundle review, EN/TR key parity, translator/reviewer workflow, legal locale approval, support capability, pseudo-locale visual QA, accessibility and rollback. Until approved, no new locale is advertised.
