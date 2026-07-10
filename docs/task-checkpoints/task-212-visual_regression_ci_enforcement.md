# Task 212 checkpoint: Visual regression CI enforcement

## Delivered

- Added a versioned visual coverage manifest for Mention Feed, Profile, Community Chat, Settings and Voice in light/dark at 1440x900.
- Added deterministic mock/reduced-motion/no-mobile contract validation.
- Added the contract gate to Windows and Ubuntu QA jobs.
- Documented the future Playwright harness, baseline, flake, threshold, artifact and activation policy.

## Intentional limitation

Playwright and tuned per-platform baselines do not exist, so pixel screenshot execution remains disabled and is not presented as passing. Contract drift blocks CI; screenshot comparison stays manual/non-blocking until activation gates are met.

## Validation

- `npm run visual:regression:contract`

Renderer/Electron source is unchanged, so typecheck/mock/build reruns are not required for this tooling/documentation-only task.
