# Task 288 - Native App Menu Foundation

## Summary

Created the MVP-safe native app menu foundation without re-enabling Electron's visible native menu bar.

## Completed

- Kept Picom's custom titlebar as the only visible window chrome.
- Expanded `menuService` with typed placeholder menu actions.
- Routed menu actions through the React app shell.
- Added Settings > Advanced simulation controls for safe local testing.
- Documented the foundation and safety rules.

## Validation

Run:

```powershell
npm run typecheck
npm run mock:smoke
npm run build
```

Manual Electron check:

- No native File/Edit/View/Window menu appears.
- Settings > Advanced can simulate app menu actions.
- The four-column desktop UI remains stable.
