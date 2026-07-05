# API Pagination Standard

Picom list APIs should converge on one cursor pagination contract so the Electron desktop client can handle mock mode, Supabase mode, and future HTTP endpoints consistently.

## Standard response shape

```ts
type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  previousCursor?: string | null;
  hasMore: boolean;
  limit: number;
};
```

The shared TypeScript contract lives in `packages/shared/src/types/pagination.ts`.

## Standard request shape

```ts
type PaginationRequest = {
  cursor?: string | null;
  previousCursor?: string | null;
  limit?: number;
  direction?: "forward" | "backward";
};
```

Backend and service-layer code may adapt this shape to Supabase range queries, keyset pagination, or SQL cursor pagination internally, but UI components should not need endpoint-specific pagination objects.

## Endpoints covered by the standard

- Messages
- Notifications
- Audit logs
- Members
- Search results
- Reports
- Saved messages
- Account activity
- Admin lists placeholder

## Compatibility rules

- Existing MVP list flows should not be broken just to rename a pagination response.
- New list endpoints should use `items`, `nextCursor`, `previousCursor`, `hasMore`, and `limit` from day one.
- Existing unpaginated endpoints should migrate through service adapters first so UI components can remain stable.
- `previousCursor` is optional because several MVP flows only page forward/backward from the current newest or oldest cursor.
- `limit` must echo the effective server-side limit after clamping.
- Empty pages should return `items: []`, `nextCursor: null`, `hasMore: false`, and the effective `limit`.

## Messages

Message pagination already uses cursor-style fields in `messageListQuery`. It should remain backward-compatible while future work moves toward sequence-aware cursors:

- Primary sort: channel message order.
- Future stable cursor: message sequence plus created timestamp and id.
- Current fallback: created timestamp cursor where sequence is unavailable.

The MessageList UI should continue to preserve scroll position when older pages are loaded.

## Notifications

Notification inbox pages should use the same response shape. Muted or digest-grouped notifications can still be returned as items as long as they do not trigger native notification spam.

## Audit logs

Audit logs should use cursor pagination ordered by newest first. Audit log entries are append-only; pagination must not imply that entries can be edited or deleted by normal app flows.

## Members

Member lists should support cursor pagination or server-side search later. Role groups in the UI can be derived after fetching the page or through future grouped endpoints.

## Search results

Search results should include only items the user is allowed to access. Pagination does not replace permission checks or Supabase RLS.

## Reports and admin lists

Reports and admin lists are placeholders for restricted views. They should use the same pagination shape while keeping sensitive moderation context redacted.

## Saved messages

Saved messages should use the standard response shape and must preserve enough context for a safe "jump to message" placeholder without leaking private channel data.

## Account activity

Account activity should use the standard response shape and only return the authenticated user's own activity. IP/device metadata must stay masked or hashed until the privacy policy is finalized.

## Frontend client expectations

- API clients should normalize legacy responses into `PaginatedResponse<T>` before exposing data to UI components.
- UI components should treat `nextCursor === null` or `hasMore === false` as the end of the list.
- Failed pagination requests should preserve already-rendered items and show a retry action where useful.
- Unsafe create/update/delete requests must not reuse pagination retry behavior.

## Future backend notes

- Supabase RLS remains the source of truth for data access.
- SQL queries should prefer keyset pagination for large tables.
- Offset pagination should be limited to small admin/debug lists or avoided.
- Realtime reconciliation must not duplicate items already loaded through pagination.

