# App Identity

Task 252 records the Picom application name and identifiers used by runtime and packaging.

## Product identity

- App name: `Picom`
- Package name: `picom`
- Product name: `Picom`
- Electron app ID: `com.picom.desktop`
- Frontend default identifier: `com.picom.desktop`

## Source locations

- `package.json`
  - `name`: `picom`
  - `description`: `Picom premium desktop community chat app.`
- `electron/appConfig.cts`
  - `name`: `Picom`
  - `appId`: `com.picom.desktop`
- `electron-builder.yml`
  - `appId`: `com.picom.desktop`
  - `productName`: `Picom`
- `src/config/appConfig.ts`
  - `VITE_APP_NAME` fallback: `Picom`
  - `VITE_APP_IDENTIFIER` fallback: `com.picom.desktop`
- `src/config/brandConfig.ts`
  - Picom brand name, tagline, logo, and icon asset references

## Rules

- Do not use Discord branding, names, logos, icons, or exact colors.
- Keep Picom app identity original.
- Do not commit production signing identities, certificates, or private app-store metadata.
- If the app ID changes later, update Electron runtime config, builder config, frontend env defaults, and docs together.

## Manual verification

1. Run `npm run build`.
2. Confirm Electron window title/product name is Picom.
3. Confirm `electron-builder.yml` uses `com.picom.desktop`.
4. Confirm frontend fallback config uses `Picom` and `com.picom.desktop`.
5. Confirm generated package artifact names start with `Picom-`.
