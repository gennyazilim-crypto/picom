# Third Party Notices

This project is a Windows/Linux/macOS Electron desktop community chat app. It does not use Discord branding, logos, copied assets, or exact Discord colors.

## Coolicons

- Project: Coolicons Free
- Source repository: https://github.com/krystonschwarze/coolicons
- Figma community file: https://www.figma.com/community/file/800815864899415771/coolicons-free-iconset
- Creator: Kryston Schwarze
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- Usage in Picom: Approved free MVP icon source and semantic icon direction used through the centralized `AppIcon` boundary.
- Modifications: Icons may be normalized for SVG/component use, semantic naming, sizing, and `currentColor` theme inheritance. Picom does not claim ownership of the original Coolicons artwork.

Only the free Coolicons set is approved. Coolicons PRO is not approved unless a separate valid license is purchased and documented before use.

The upstream repository publishes its license statement in the README and links to CC BY 4.0; it does not currently provide a standalone `LICENSE` file. This notice preserves creator, source, license link, usage, and modification attribution without inventing an upstream license file.

## Brand and asset guardrail

The Picom logo and generated mock imagery are project-owned placeholders. They are not Discord assets and are not part of the Coolicons set.

## Automated dependency inventory

The npm dependency inventory is generated from the committed lockfile:

- Generate/update: `npm run licenses:generate`
- Verify committed report and block missing/proprietary metadata: `npm run licenses:check`
- Generated report: `THIRD_PARTY_LICENSES.generated.md`

CI runs the check after `npm ci`. The generated inventory lists metadata; it does not copy full license texts, determine compatibility, or replace legal review. A reviewer must inspect license obligations, notices/source-offer requirements, dependency purpose, bundled versus development-only status, and release artifacts before distribution.

Current dependency areas include:

- React and React DOM
- Vite and TypeScript
- Electron and electron-builder
- Supabase JavaScript client
- LiveKit client
- Development helper packages

Do not bundle proprietary assets, Coolicons PRO assets, unlicensed UI kit exports, copied Discord assets, or third-party images without documented rights.

Coolicons attribution above is manually maintained because it is an asset license, not an npm lockfile dependency. Automation must never remove it.
