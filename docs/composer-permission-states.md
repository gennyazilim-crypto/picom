# Composer Permission States

Status: implemented as MVP-safe UI foundation

Picom now supports a simple disabled composer state for users who should not be able to send messages in the active text channel.

## Behavior

- `ChatMain` derives a composer disabled reason from the current member role.
- Members with role level below `10` see a read-only composer hint.
- Disabled composer blocks text entry, send, attach, emoji, GIF placeholder, paste attachments, and drag/drop attachments.
- Existing Owner/Admin/Moderator/Member mock users keep normal composer behavior.
- Backend/Supabase permissions remain the source of truth for real enforcement.

## UI

- Inline hint explains why sending is unavailable.
- Disabled composer uses existing design tokens for warning color, border, surface, and muted text.
- Layout dimensions are unchanged; sidebars remain fixed and chat scroll remains independent.

## Manual verification

1. Use the default mock owner user and confirm composer still sends normally.
2. Temporarily change the current mock user role to `guest` in mock data for local QA.
3. Confirm composer shows: `You do not have permission to send messages in this channel.`
4. Confirm send/attach/emoji/GIF actions are disabled.
5. Restore the mock role after manual QA.
