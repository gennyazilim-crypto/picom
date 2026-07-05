# Plugin System Architecture

Status: post-MVP architecture document

Picom may support extensions in the future, but the current MVP must not execute arbitrary plugin code. This document defines safe boundaries for a future plugin or integration platform.

## Goals

- Allow future integrations to extend Picom in controlled ways.
- Keep desktop app security and native IPC boundaries intact.
- Keep Supabase Auth/RLS as the data access authority.
- Provide a safer distinction between backend bots, webhooks, and desktop UI plugins.

## Non-goals

- No plugin runtime in the MVP.
- No dynamic code loading.
- No arbitrary JavaScript execution.
- No shell access.
- No filesystem access.
- No raw token access.
- No marketplace or public plugin publishing.
- No analytics collection of message content or sensitive user data.

## Security boundaries

Future plugin capabilities must be deny-by-default:

- no Node.js APIs in renderer plugins
- no Electron object exposure
- no direct preload bridge access
- no shell command execution
- no arbitrary file reads/writes
- no direct Supabase service-role access
- no access to passwords, tokens, cookies, authorization headers, or session secrets

## Allowed extension points placeholder

Possible future extension points, after review:

- slash command registration through typed metadata
- message context menu action registration through safe actions
- channel tools panel placeholder
- bot API integration through backend-managed tokens
- webhook configuration through channel settings
- read-only UI cards with strict data DTOs

## Forbidden capabilities

- executing downloaded code
- eval/new Function/importing remote scripts
- native module loading
- arbitrary IPC channel calls
- direct database access
- bypassing RLS
- scraping private messages outside granted scopes
- modifying app settings without user confirmation
- exfiltrating logs or diagnostics

## Permissions model placeholder

Future plugins should request explicit scopes:

- `commands:register`
- `messages:send` via backend bot identity only
- `channels:read` with RLS enforcement
- `webhooks:manage` with channel permission checks
- `ui:render-card` with sanitized DTOs only

Scopes must be reviewed and visible to the user/admin before installation.

## Review and signing placeholder

Before any plugin runtime exists:

- require plugin manifest validation
- require human review or trusted publisher process
- require signing placeholder for distributed plugin packages
- reject unknown permissions
- record install/update events in audit logs

## Desktop plugin vs bot API

Desktop plugins and bots should remain separate:

- Bot API: backend identity, server-side tokens, rate limits, audit logs.
- Desktop plugin: local UI extension only, no raw secrets, no native access.
- Webhooks: inbound channel posting only, token hashed and rate limited.

## UI extension restrictions

- Must use Picom design tokens.
- Must not introduce mobile UI.
- Must not mimic system/security dialogs.
- Must not use Discord branding/assets/colors.
- Must not inject unsafe HTML.
- Must not load untrusted remote images without URL safety checks.

## Sandboxing approach placeholder

Preferred future direction:

- no arbitrary runtime code for early platform phase
- manifest-driven integrations first
- server-side bot/webhook actions before local plugin UI code
- if local UI extensions are ever allowed, use isolated sandboxed renderers with strict CSP and explicit message channels

## Risks

- Token leakage through poorly designed extension APIs.
- Data exfiltration from private channels.
- Native IPC abuse.
- Performance regressions from extension rendering.
- Marketplace moderation and malware risk.

## Implementation decision

This is documentation-only. No plugin loader, dynamic import path, sandbox, marketplace, runtime hook, or extension API is added in this task.
