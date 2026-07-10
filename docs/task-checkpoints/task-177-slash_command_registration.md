# Task 177: Slash command registration

## Completed

- Split trusted built-in commands from future bot/plugin command metadata.
- Added permission filtering for composer suggestions and a second check on selection.
- Bounded suggestions to eight results and retained prefix-only lookup.
- Added strict metadata validation that rejects handlers and unexpected executable fields.
- Fixed the existing built-in text command character encoding.
- Documented the registry and security boundary.

## Safety

- No dynamic code loading or arbitrary plugin execution was added.
- External command metadata is not surfaced for execution.
- Backend authorization remains required for any future bot/plugin dispatch.

## Verification

- `npm run slash:commands:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
