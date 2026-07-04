# Message Fetch Pagination Query

Task 152 adds a typed message fetch query with a cursor pagination placeholder.

## API

`messageService.listMessages(input)` accepts:

- `communityId`
- `channelId`
- `limit` optional, default 50, max 100
- `before` optional cursor based on `createdAt`

It returns:

- `items`
- `nextCursor`
- `previousCursor` placeholder
- `hasMore`
- `limit`

## Ordering

The query fetches newest records first for efficient pagination, then returns the page in chronological order for the chat UI.

## Mock mode

Mock mode filters `mockCommunities` by community/channel and applies the same cursor shape without requiring Supabase.

## Supabase mode

Supabase mode queries `public.messages` with:

- community id
- channel id
- `deleted_at is null`
- descending `created_at`
- `limit + 1` to calculate `hasMore`

RLS remains responsible for access control.

## Placeholder notes

`previousCursor` is currently `null`. Future infinite scroll can extend this once the UI supports loading newer context or bidirectional pagination.