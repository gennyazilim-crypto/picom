# Branding QA

Picom uses its own visual identity and must not ship Discord branding, logos, copied assets, or exact Discord colors.

## Command

```powershell
npm run branding:smoke
```

`npm run qa:smoke` includes this check.

## Runtime files scanned

- `src/`
- `electron/`
- `assets/`

## Blocked examples

- Discord product name in runtime UI/source
- Discord CDN/app URLs
- copied Discord brand color values
- copied Discord assets or logos

## Manual QA

- Confirm Picom logo is used.
- Confirm Coolicons/AppIcon remains the icon system.
- Confirm UI uses Picom design tokens and palette.
- Confirm docs may mention Discord only as a prohibited reference, not as app branding.
