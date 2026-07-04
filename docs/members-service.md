# Members Service

Task 157 adds the MVP community members service boundary.

## API

`membersService.listMembers(communityId)` returns safe `MemberSummary` DTOs.

## Mock mode

Mock mode maps the existing desktop mock members into `MemberSummary` records so the UI can keep using rich local member data.

## Supabase mode

Supabase mode currently queries `public.community_members` only:

- id
- community id
- user id
- role id
- joined timestamp

Profile and role expansion is intentionally deferred so this task stays small and avoids guessing at relationship metadata before generated Supabase types are available.

## Security

The service does not expose secrets, tokens, auth sessions, or private server-only fields. Supabase RLS remains responsible for community access boundaries.