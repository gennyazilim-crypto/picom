# Licenses and Third-Party Notices

Picom has a license placeholder only. The final project license must be selected before public release.

## Project license status

- Current status: license not finalized.
- Current file: `LICENSE` placeholder.
- This is not final legal advice and not a final legal document.
- Public distribution should wait until the project owner chooses and approves a license.

## Third-party notices

Third-party notices are maintained in `THIRD_PARTY_NOTICES.md`.

Required current attribution:

- Coolicons
- Creator: Kryston Schwarze
- License: CC BY 4.0
- Source: official Coolicons repository or Figma community file

## Review process

Before beta/stable release:

1. Run `npm ci` and `npm run licenses:generate` after an approved dependency change.
2. Review `THIRD_PARTY_LICENSES.generated.md`, then run `npm run licenses:check`.
3. Confirm Electron, React, Vite, Supabase, LiveKit, and build tooling licenses are acceptable.
4. Confirm no proprietary assets are bundled without rights.
5. Confirm no Discord branding, logo, icons, copied assets, or exact colors are used.
6. Confirm Coolicons attribution remains in `THIRD_PARTY_NOTICES.md`.
7. Update release notes if new third-party assets or libraries are added.

## Asset policy

- Picom logo/assets must be original or explicitly licensed.
- Coolicons Free is approved with attribution.
- Coolicons PRO is not approved unless purchased and documented.
- External UI kit assets must not be shipped unless the license permits it.
- Mock avatars/images must be generated, original, or licensed for use.

## Automation policy

- The generator reads only committed `package-lock.json` metadata and adds no license-scanner dependency.
- Output is deterministic and committed so pull requests show license drift.
- CI fails when the report is stale, license metadata is missing, or an expression explicitly indicates proprietary/UNLICENSED/SEE LICENSE handling.
- Passing automation is not legal approval. Complex/dual licenses, copyleft obligations, native binaries, fonts, UI kits, artwork, and bundled license text still require human review.
- Coolicons remains in manual notices under CC BY 4.0 attribution.
- No proprietary asset may be added merely because dependency metadata passes.

## Known open items

- Final project license selection.
- Final human review of each distributed release artifact and its bundled notices.
- Final legal review before public release.
