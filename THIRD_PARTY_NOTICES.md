# Third-Party Notices

## Iconix

- Name: Iconix
- Creator: Rijal
- Source: [Iconix by Rijal (Figma Community)](https://www.figma.com/design/89xytB3wWa8vYnVIGFXXZP/Iconix-by-Rijal--Community-?node-id=0-1)
- Creator showcase: [Iconix icon set](https://dribbble.com/shots/18522347-Iconix-Icon-set)
- Availability: The creator describes Iconix as a free vector icon set released through Figma Community.
- License note: The public Figma metadata available during integration did not expose an explicit SPDX or redistribution license identifier. The vectors were exported from the user-authorized Figma resource. Confirm the applicable redistribution terms before a public production release.

Picom uses Iconix as its single interface icon direction. The source vectors are normalized into `public/icons/iconix.svg`, inherit `currentColor`, and are consumed only through the reusable `AppIcon` component. Product-specific controls not present in the source frame use small supplemental glyphs drawn to the same 24px, 1.5px rounded-stroke specification inside that sprite.

## Coolicons

- Project: Coolicons Free
- Source repository: [krystonschwarze/coolicons](https://github.com/krystonschwarze/coolicons)
- Figma community file: [Coolicons Free Iconset](https://www.figma.com/community/file/800815864899415771/coolicons-free-iconset)
- Creator: Kryston Schwarze
- License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- Usage in Picom: Approved free MVP icon source and semantic icon direction used through the centralized `AppIcon` boundary.
- Modifications: Icons may be normalized for SVG sprite/component use, semantic naming, sizing, and `currentColor` theme inheritance. Picom does not claim ownership of the original Coolicons artwork.

Only the free Coolicons set is approved. Coolicons PRO is not approved unless a separate valid license is purchased and documented before use.

The upstream repository publishes its license statement in the README and links to CC BY 4.0; it does not currently provide a standalone `LICENSE` file. This notice preserves the required creator, source, license link, usage, and modification attribution without inventing an upstream license file.

## Automated dependency inventory

The npm dependency inventory is generated from the committed lockfile:

- Generate/update: `npm run licenses:generate`
- Verify committed report: `npm run licenses:check`
- Generated report: `THIRD_PARTY_LICENSES.generated.md`

CI verifies the generated inventory after `npm ci`. The report is metadata, not a replacement for legal review or third-party asset attribution.

## Asset guardrails

- Do not bundle proprietary assets, unlicensed UI kit exports, copied brand assets, or paid icon sets without documented rights.
- Picom's application logo and generated mock imagery are original project assets, not Iconix assets.
- No Discord branding, logos, copied assets, or exact Discord colors are included.
- No proprietary or paid Iconix assets are included by this integration.
- No Coolicons PRO assets are included without a separately documented license.
- Do not replace `AppIcon` with a second icon library in UI components; add approved semantic mappings through the central icon boundary instead.
