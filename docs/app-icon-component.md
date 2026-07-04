# AppIcon component

Task 049 formalizes `AppIcon` as the single MVP icon component.

## Contract

- Icon names are typed by `IconName`.
- Icon sizes are typed by `IconSize` and use the approved scale: xs, sm, md, lg, xl.
- SVGs use `currentColor` so colors come from design tokens.
- Icons are decorative by default with `aria-hidden`.
- If an icon itself needs an accessible label, pass `ariaLabel`; icon-only buttons should still prefer `aria-label` on the button.
- The component does not import external icon packages.

## Guardrails

- New icons must come from the free Coolicons source policy.
- Do not add mixed icon libraries.
- Do not add Discord icons or assets.