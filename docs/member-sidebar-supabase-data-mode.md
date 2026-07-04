# MemberSidebar Supabase Data Mode

Task 161 connects the MemberSidebar to Supabase data mode.

## Behavior

- Mock mode keeps using local mock members.
- Supabase mode loads members for the active community after sign-in.
- Member data is fetched through `membersService.listMembers()`.
- The service reads `community_members` and enriches with visible `profiles` data when available.
- If Supabase returns no members, the existing safe placeholder member is kept to avoid an empty current-user crash.

## RLS and security

The renderer uses the normal Supabase client only. It does not bypass RLS and does not use service-role credentials. Access to member/profile rows is controlled by Supabase policies.

## Environment variables

Supabase mode requires:

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use `.env.local` for local values. Do not commit secrets.

## Manual verification

1. Start the app in Supabase mode.
2. Sign in as a seeded user.
3. Select a community.
4. Confirm MemberSidebar shows members visible to that user.
5. Search in MemberSidebar and confirm local filtering still works.
6. Confirm mock mode still shows deterministic mock members.