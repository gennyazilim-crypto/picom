# Login Animation and Brand Assets Update

Date: 2026-07-10

## Scope

- Confirmed the active React/CSS login background matches the light/dark v3 design supplied in `Picom login sayfası animasyonu2.zip`.
- Kept the animation native to the renderer instead of embedding external HTML or the unused 18 MB preview video.
- Replaced the shared Picom logo asset with `final_hq_transparent_logo.png` while preserving existing import paths.
- Rebuilt Windows, Linux, macOS and tray icon resources from `icon_microphone.png`.

## Updated assets

- `assets/brand/picom-logo-concept.png`
- `assets/brand/app-icon.png`
- `assets/brand/app-icon.ico`
- `assets/brand/app-icon.svg`
- `assets/brand/icons/16x16.png`
- `assets/brand/icons/32x32.png`
- `assets/brand/icons/64x64.png`
- `assets/brand/icons/128x128.png`
- `assets/brand/icons/256x256.png`
- `assets/brand/icons/512x512.png`
- `assets/brand/icons/1024x1024.png`

## Expected behavior

- Login and register screens use the supplied light/dark animation through the existing theme state.
- Login, register, titlebar and ServerRail render the new transparent logo through the existing canonical asset path.
- Electron tray and Windows/Linux/macOS package definitions resolve to the new microphone icon resources.
