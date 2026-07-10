# Task 244 checkpoint: local data migration v2

- Added a coordinated local-data schema manifest and ordered migration registry invoked before renderer services start.
- Advanced settings to schema 3, normalized legacy draft keys/records, and validated only non-sensitive remote-config cache metadata.
- Added scope-limited, bounded local backups plus per-scope safe reset so corruption cannot crash startup.
- Auth/session stores, passwords, tokens, authorization headers, provider secrets, and LiveKit credentials are explicitly outside migration enumeration.

Validation: `npm run local-data:migration:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.

Remaining edge case: an environment that permits reading `localStorage` but rejects the final manifest write because of quota/runtime policy needs an additional startup recovery guard in Task 245.
