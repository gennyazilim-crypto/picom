# Task 032 Checkpoint

Task: Create custom WindowTitleBar

## Completed

- Created `src/components/WindowTitleBar.tsx`.
- Moved the existing custom title bar UI out of `App.tsx` without redesigning it.
- Preserved Picom logo, command search button, connection pill, theme toggle, and window controls.
- Window controls still use `windowService`, keeping Electron APIs outside React UI code.
- Icon-only title bar controls keep `aria-label` attributes.

## Verification

Commands run:

```powershell
npm run typecheck
npm run build
```

Both passed.

Manual visual check:

```powershell
npm run dev
```

Confirm the top custom title bar renders, search opens, theme toggles, and window buttons are visible.