# Task 094 Checkpoint: Plugin System Security Design

## Outcome

Documented a deny-by-default security architecture for possible future Picom extensions without implementing or executing plugins.

## Covered

- Goals, non-goals, threat model, and Electron/backend boundaries.
- Explicit ban on renderer execution, shell, filesystem, process, raw network, native IPC, and secrets.
- Declarative, utility-process, WebAssembly, and iframe sandbox tradeoffs.
- Signing, review, provenance, revocation, update, and kill-switch requirements.
- Bot API versus desktop plugin distinction.
- Narrow allowed UI slots and forbidden UI behavior.
- Capability permissions, network/storage brokers, auditing, validation, and residual risks.

## Safety

- No plugin loader, package, manifest parser, dynamic import, `eval`, sandbox process, public marketplace, or code execution was added.
- No runtime code or UI behavior changed.
- Existing bot/webhook foundations remain server-scoped and separate.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
