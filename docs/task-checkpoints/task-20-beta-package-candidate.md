# Task 20 Checkpoint: Beta Package Candidate

## Result

Packaging metadata, icon paths, packaged entry/preload paths, Electron renderer security settings, and Windows/Linux/macOS target commands were verified and documented.

## Validation

- `npm run typecheck`: pass
- `npm run mock:smoke`: pass
- `npm run build`: pass with the existing non-blocking Vite chunk-size warning
- `npm run package:verify`: pass
- Initial `npm run package:win`: blocked by stale Picom Vite/Electron processes holding the output directory
- Isolated output retry: confirmed the same process-lock symptom
- Final `npm run package:win` after targeted process cleanup: pass

## Artifact status

The Windows NSIS candidate exists at `release/Picom-0.1.0-Windows-x64.exe` with SHA-256 `BCF30CA769548E70938B81C219998CE33F5D5C3CACA379A48CAC9BD8EC55117B`. Linux and macOS artifacts still require native target build hosts.

## Safety

- No certificate, signing password, or backend secret was added.
- No UI or runtime feature behavior changed.
- The custom Electron titlebar and safe preload architecture remain unchanged.

## Follow-up

Complete clean-account Windows install/launch/uninstall smoke testing, then build and test Linux/macOS candidates on native hosts.
