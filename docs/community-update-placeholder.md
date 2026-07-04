# Community update placeholder

Task 146 adds a service-level community update placeholder.

## Method

```text
communityService.updateCommunityPlaceholder(input)
```

## Scope

This is not wired into the desktop UI yet. It prepares the data-service boundary for future Community Settings work.

## Behavior

- Validates community ID, optional name, and optional description length.
- Mock mode returns a safe updated summary placeholder.
- Supabase mode calls `public.communities.update()` using the anon client and relies on RLS owner policy.
- No service-role key or privileged renderer access is used.

## Manual test steps

1. In mock mode, call `updateCommunityPlaceholder({ id: "aurora", name: "Aurora Updated" })`.
2. Confirm it returns a `CommunitySummary` without requiring Supabase.
3. In Supabase mode, sign in as a community owner and call the same method with a real community ID.
4. Confirm owner updates succeed and non-owner updates are rejected by RLS.
5. Run `npm run typecheck` and `npm run build`.