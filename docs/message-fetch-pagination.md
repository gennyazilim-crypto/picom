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

The query fetches newest records first for efficient pagination, then returns the page in chronological order for the chat UI. When `sequence` exists, the client and Supabase query prefer sequence ordering and fall back to `createdAt` for older or mock data.

## Mock mode

Mock mode filters `mockCommunities` by community/channel and applies the same cursor shape without requiring Supabase.

## Supabase mode

Supabase mode queries `public.messages` with:

- community id
- channel id
- `deleted_at is null`
- descending `sequence` when available
- descending `created_at`
- `limit + 1` to calculate `hasMore`

RLS remains responsible for access control.

## Placeholder notes

`previousCursor` is currently `null`. The current `before` cursor remains timestamp-based for backward compatibility; future pagination can move to a compound `(sequence, created_at, id)` cursor once sequence numbers are fully deployed.
