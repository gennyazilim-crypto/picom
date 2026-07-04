# License and Branding Guardrails

Picom must remain an original desktop chat product. The reference image defines quality and structure, not brand ownership, assets, or exact color usage.

## Prohibited brand and asset usage

Do not use:

- Discord branding
- Discord logo
- Discord icons
- Discord copied assets
- Discord exact colors
- Any third-party proprietary artwork without documented rights

## Approved MVP icon system

Coolicons Free is the single approved MVP icon system.

- Icons should be rendered through `AppIcon` or the approved icon registry.
- Icons must use `currentColor` so light/dark themes work through tokens.
- Icon-only buttons must have an `aria-label`.
- Do not mix icon sets unless a future task explicitly changes the icon policy.
- Do not use Coolicons PRO assets unless a PRO license is purchased and documented.

## Coolicons attribution

Coolicons attribution is maintained in `THIRD_PARTY_NOTICES.md`.

Required attribution details:

- Name: Coolicons
- Creator: Kryston Schwarze
- License: CC BY 4.0
- Source: official Coolicons repository or Figma community file

## Picom identity

Picom should use:

- the Picom logo supplied by the project owner
- the Picom palette: `#007571`, `#10C2BB`, `#C24D0F`, `#FF772E`, `#752C05`
- original surfaces, spacing, and interaction details
- design tokens for all reusable visual states

## Review checklist

Before committing UI work, verify:

- no Discord asset or brand reference was added
- icon-only buttons have `aria-label`
- icons use `currentColor`
- colors come from Picom tokens
- third-party assets have documented licenses
- Coolicons attribution remains present