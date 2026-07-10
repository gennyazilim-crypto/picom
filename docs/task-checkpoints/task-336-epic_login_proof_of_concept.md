# Task 336 - Epic login proof of concept

Status: intentionally deferred; EAS/EOS identity architecture and approval gates documented.

## Outcome

- Assessed Epic Account Services Auth, EOS Connect and account-linking boundaries.
- Defined a server-side authorization/callback design with a private Epic-identity-to-Picom-profile mapping.
- Documented secret handling, session authority, collision/recovery controls, risks and packaged desktop certification.
- Preserved email/password as the primary authentication path.
- Added no Epic button, native SDK, renderer token flow, secret, migration or endpoint.

## Validation

This task changes Markdown only. `npm run typecheck`, `npm run mock:smoke` and `npm run build` were skipped under the documentation-only task allowance because runtime code, dependencies and build configuration are unchanged.

## Remaining approval blockers

- Product decision and Epic-supported use-case confirmation.
- Security/privacy review and hosted provider configuration.
- Supabase session-bridge and private identity-mapping review.
- Windows/Linux/macOS packaged certification.

