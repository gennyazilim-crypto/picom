# Slash Command Registry

Picom keeps slash command discovery predictable and safe by separating executable built-in commands from future bot or plugin registrations.

## Built-in commands

Built-in commands are a frozen, typed registry shipped with the desktop client. The composer filters this registry by prefix and permission, limits suggestions to eight items, and checks permission again when the user selects a command. Command behavior stays in trusted Picom code.

## Bot and plugin registrations

Bot and plugin commands use a separate metadata-only registry. A registration may contain its source, provider ID, command name, description, and a required permission label. It cannot contain handlers, functions, scripts, URLs to execute, or arbitrary payloads. The registry records metadata only and never executes bot or plugin code.

External registrations are not included in composer suggestions until a future authenticated backend command-dispatch API exists. Registration requires an explicit authorization result supplied by the trusted service layer. Backend permissions must be rechecked before any future dispatch; frontend filtering is only user experience.

## Performance and validation

- Suggestions run only for a single-token `/prefix` input.
- Built-in lookup is bounded to a small frozen array and at most eight results.
- Names and provider IDs use strict length-limited character sets.
- Descriptions are trimmed and limited to 160 characters.
- Runtime objects containing unexpected fields are rejected.

## Security boundary

The renderer must not dynamically load modules, evaluate strings, invoke shell commands, or call arbitrary plugin callbacks. Future bot commands should cross a versioned backend API with authentication, rate limits, audit logging, and server-side permission checks. A future desktop plugin sandbox requires a separate reviewed architecture and is not enabled by this registry.
