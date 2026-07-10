# Task 211 checkpoint: Performance budgets enforcement CI

## Delivered

- Added dependency-free CI measurement of generated JS, CSS, largest image and total renderer assets.
- Added target warnings and hard-fail caps with named owners/remediation exceptions.
- Wired enforcement after the production build on Windows and Ubuntu QA jobs.
- Updated performance/bundle documentation and existing smoke tests.

## Policy

- Current JS/CSS target overruns are reported, not hidden.
- Growth beyond baseline-protecting hard caps fails CI.
- Cap changes require measured justification, owner and stable-release remediation.
- Startup/render/interaction/memory remain RC/manual gates until deterministic packaged Electron runners exist.

## Validation

- `npm run performance:budget:smoke`
- `npm run bundle:size:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run performance:budget:ci`
