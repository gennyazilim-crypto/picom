# Picom Localization Runtime

Picom provides a typed catalog for English and Turkish Picom-controlled interface copy. English is the fallback when a key or stored language is invalid. The selected language is a device-local appearance preference and updates the document language plus locale-aware date/time formatting immediately.

## Safety boundary

User-generated messages, names, community content, attachments, bios, and moderation evidence are never translated automatically. Catalog keys are used only by Picom-owned interface surfaces. Provider error normalization remains service-owned and must not expose raw provider diagnostics.

## Runtime architecture

- localizationService owns the typed catalog and Settings section labels.
- appearanceService applies the selected language to the document and dateTimeService.
- dateTimeService uses tr-TR or en-US together with the chosen date style and 12/24-hour preference.
- Settings > Appearance is the first complete localized control surface and establishes the catalog path for additional Picom-owned copy.
- Legal documents retain their approved source language and version; they are not machine-translated.

## Desktop QA

Test English and Turkish at 1440x900 and 1100x700 on Windows, Linux, and macOS. Verify titlebar and the four-column desktop shell remain stable, Settings labels do not overflow, dates and relative times use the chosen locale, and no mobile navigation appears. A pseudo-locale remains useful for future catalog expansion but is not exposed to users.
