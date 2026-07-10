# Task 238 checkpoint: Developer Portal beta

- Relabeled the existing feature-flagged/permission-gated safe metadata portal as restricted beta.
- Kept applications/API keys/OAuth/public publishing/runtime disabled; raw token/hash/URL/content remain excluded.
- Verified production bot credential issue/revoke audit contracts.
- Validation: `npm run developer:portal:beta:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.
