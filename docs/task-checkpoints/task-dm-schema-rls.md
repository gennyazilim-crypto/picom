# Task checkpoint: Direct Messages schema and RLS

## Result

The Direct Messages data foundation now uses a canonical participant table and participant-only RLS across conversations, messages, attachments, and reactions. The migration preserves existing membership rows while adding reply, last-message, mute, archive, and block fields.

## Security guarantees

- Non-participants cannot read conversation metadata or related rows.
- Only unblocked participants can send messages, attachments, and reactions.
- Authors can update/delete only their own messages.
- Users can remove only their own reactions.
- Direct Messages remain excluded from global search and Mention Feed.

## Validation commands

```powershell
npm run dm:schema:rls:smoke
npm run supabase:smoke
npm run supabase:rls:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

Live pgTAP verification requires Supabase CLI and Docker: `npm run supabase:rls:test`.
