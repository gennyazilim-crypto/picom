# Slash Commands Placeholder

Status: post-MVP placeholder

Slash commands are planned as a compact command-like interaction layer inside Picom's MessageComposer. This placeholder keeps the future design clear without changing the current MVP composer behavior.

## MVP stance

- Slash commands are not enabled in the current desktop MVP runtime.
- Existing message sending, attachments, emoji, replies, and local/Supabase chat flows must remain unchanged.
- Unknown slash-prefixed text should continue to behave like normal message text until a command runtime is intentionally enabled.

## Future built-in command examples

Potential future commands:

- `/help` opens local Help Center content.
- `/invite` opens Invite People when the user has permission.
- `/me` formats an action-style message placeholder.
- `/shrug` inserts `¯\\_(ツ)_/¯` into the composer.
- `/tableflip` inserts `(╯°□°）╯︵ ┻━┻` into the composer.
- `/topic` opens channel topic edit placeholder when permitted.
- `/poll` opens the future Create Poll flow when enabled.

## UI behavior placeholder

Future composer behavior should be desktop-native and compact:

- Typing `/` at the start of the composer can open a suggestion popover.
- Suggestions show command name, description, and usage.
- Up/Down selects a suggestion.
- Enter applies the selected command.
- Escape closes suggestions without clearing typed text.
- The popover must not introduce mobile-style sheets or bottom navigation.

## Security boundaries

- Slash commands must not execute arbitrary code.
- Commands must be registered through a typed registry, not dynamic script loading.
- Permission-sensitive commands must still validate permissions on the backend.
- Frontend visibility is only UX; it is not security enforcement.
- Commands must not expose tokens, session data, raw logs, or private diagnostics.

## Future command registry shape

A future typed command definition can include:

- `id`
- `name`
- `description`
- `usage`
- `availability`
- `requiredPermission` optional
- `execute()` handler bound to approved app actions only

Handlers should call existing services and stores rather than importing native Electron APIs or Supabase clients directly from UI components.

## Feature flag behavior

A future flag such as `enableSlashCommands` should control entry point visibility. If disabled, deep-linked or programmatic command execution should fail safely with a clear unavailable state.

## Manual verification

- Confirm typing normal messages still works.
- Confirm `/hello` sends as normal text today.
- Confirm no slash command suggestion UI appears until the feature is intentionally enabled later.
