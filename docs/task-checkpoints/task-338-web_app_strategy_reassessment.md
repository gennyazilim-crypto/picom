# Task 338 - Web app strategy reassessment

Status: completed as documentation-only analysis; public web distribution remains deferred.

## Outcome

- Reaffirmed Electron as Picom's supported Windows/Linux/macOS distribution.
- Distinguished development browser fallback from a production web product.
- Documented browser/native limitations, changed security boundaries and reuse potential.
- Defined candidate future scopes, discovery steps and approval gates.
- Added no web deployment, responsive redesign, PWA, service worker or runtime code.

## Validation

This task changes Markdown only. `npm run typecheck`, `npm run mock:smoke` and `npm run build` were skipped under the documentation-only task allowance because runtime code, dependencies and build configuration are unchanged.

## Remaining decision

A web client requires a validated web-specific need, hosted backend policy certification, browser threat model, supported-browser matrix and separate product/security/operations approval.

