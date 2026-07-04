# Icon usage audit

Task 046 is a read-only audit of current MVP icon usage.

## Findings

- Runtime UI icons are routed through `src/components/AppIcon.tsx`.
- `AppIcon` renders inline SVG with `stroke="currentColor"`, so icons follow light/dark theme tokens.
- No `lucide-react`, `react-icons`, Font Awesome, Heroicons, or other icon package import was found in `src`.
- Coolicons attribution exists in `THIRD_PARTY_NOTICES.md`.
- Icon-only controls in the extracted MVP shell components use `aria-label` for window controls, rail actions, chat header actions, composer actions, and modal close controls.
- Picom logo images are brand assets, not UI icon-set replacements.
- Mock attachment SVG data in `src/data/mockCommunities.ts` is generated placeholder content, not a UI icon system.

## Risks / TODO

- `AppIcon` currently contains hand-maintained SVG paths. The project should later replace or verify each path against the free Coolicons source set before release freeze.
- Existing inline overlay components in `App.tsx` still use `AppIcon`; future extraction should keep this rule intact.
- Continue requiring `aria-label` on any new icon-only button.

## Commands used

- `Get-Content src/components/AppIcon.tsx -Raw`
- `rg "lucide-react|react-icons|heroicons|phosphor|fontawesome|coolicons|AppIcon|<svg|<img" ...`