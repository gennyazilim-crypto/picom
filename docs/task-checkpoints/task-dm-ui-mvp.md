# Task checkpoint: Direct Messages UI MVP

## Result

The existing Direct Messages route now renders a complete desktop workspace: conversation navigation, private chat, and a participant details panel. The ServerRail DM icon and existing `activeView` routing remain the navigation source of truth.

## Included

- Searchable conversation sidebar with Friends and pending-request entry points.
- Active conversation header, message search, shared-media and more actions.
- Local message sending with Enter and multiline input with Shift+Enter.
- Emoji insertion, attachment action state, reply previews, reactions, and image attachments.
- Profile summary, mutual communities, shared media, and local privacy action states.
- Mock-first data with the existing Supabase service boundary preserved.

## Validation

```powershell
npm run typecheck
npm run mock:smoke
npm run build
```

Manual verification: open the DM icon in ServerRail, search/select a conversation, send a message, inspect media/reactions/replies, and verify Home/community/profile navigation remains available.
