# Setup Localization QA: English and Turkish

## Scope

Task 382 localizes the first-launch setup experience in English and Turkish.
It does not claim that the entire Picom application or native operating-system
installer framework is localized.

## Behavior

- The initial setup language follows `navigator.language` for Turkish (`tr*`)
  and otherwise defaults safely to English.
- Users can switch between English and Türkçe inside setup.
- Theme, step, guide, action, status, and accessibility copy updates together.
- Product names, usernames, community/channel names, messages, and other
  user-generated content are never translated.

## Desktop fit matrix

Test both languages at 1100x700 and 1440x900 in light/dark themes. Verify:

- five step labels fit the setup rail;
- Turkish permission and completion titles do not clip;
- permission cards wrap without horizontal overflow;
- `Daha sonra ayarla` and `İzin rehberini görüntüle` remain fully usable;
- footer actions wrap within the panel rather than leaving the viewport;
- focus order and accessible labels follow visible language;
- changing language does not reset the selected theme or current step.

## Native installer boundary

Electron-builder/NSIS/DMG/Linux package framework copy requires separate native
localization resources and target-host QA. Until that work is reviewed, package
framework text may follow the host language while Picom's first launch supports
English/Turkish. Do not advertise full installer localization yet.

## Automated checks

```bash
npm run first-launch:smoke
npm run typecheck
npm run mock:smoke
npm run build
```
