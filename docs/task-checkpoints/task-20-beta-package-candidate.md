# Task 20 Checkpoint: Beta Package Candidate

## Result

Packaging metadata, icon paths, packaged entry/preload paths, Electron renderer security settings, and Windows/Linux/macOS target commands were verified and documented.

Standard `build:desktop` and `package:windows` aliases now map to the existing verified build/package commands without changing dev mode.

## Validation

- `npm run typecheck`: pass
- `npm run mock:smoke`: pass
- `npm run build`: pass with the existing non-blocking Vite chunk-size warning
- `npm run package:verify`: pass
- Initial `npm run package:win`: blocked by stale Picom Vite/Electron processes holding the output directory
- Isolated output retry: confirmed the same process-lock symptom
- Final `npm run package:win` after targeted process cleanup: pass

## Artifact status

The refreshed Windows NSIS candidate exists at `release/Picom-0.1.0-Windows-x64.exe` with SHA-256 `2461CE1C18CEEFD0003FB85B4212BB1DE084AAAC2E3BAE9BE6F77B98CC63230C`. It includes the owner-approved `desktop_icon_v2.png` derivatives. The renderer uses relative Vite asset paths so packaged `file://` loading does not produce a white screen. Linux and macOS artifacts still require native target build hosts.

## Safety

- No certificate, signing password, or backend secret was added.
- No UI or runtime feature behavior changed.
- The custom Electron titlebar and safe preload architecture remain unchanged.

## Follow-up

Complete clean-account Windows install/launch/uninstall smoke testing, then build and test Linux/macOS candidates on native hosts.
