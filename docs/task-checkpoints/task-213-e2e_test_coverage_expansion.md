# Task 213 checkpoint: E2E test coverage expansion

## Delivered

- Added a versioned core-flow E2E coverage manifest and CI contract gate.
- Mapped seven required flows to existing safe preflight commands.
- Documented separate future mock/staging UI runners, scenarios, commands, environment/artifact safety and activation order.
- Explicitly prohibited production targeting and false E2E claims.

## Intentional limitation

No Playwright/UI runner or protected staging environment exists, so UI automation remains planned. Existing smoke scripts are preflight evidence, not end-to-end success.

## Validation

- `npm run e2e:coverage:contract`

App runtime source is unchanged, so typecheck/mock/build reruns are not required for this contract/tooling documentation task.
