# Picom RLS Regression Suite

## Safety

Run only against the local Supabase stack or an approved disposable/staging project. Never run fixtures against production. The SQL tests wrap fixtures in transactions and end with `rollback`.

## Automated paths

Structural/source preflight without database access:

```powershell
npm run supabase:rls:smoke
```

Real local pgTAP execution after installing and starting Supabase CLI:

```powershell
supabase start
supabase db reset
npm run supabase:rls:test
```

Files executed:

- `supabase/tests/rls/community_access_boundaries.sql`
- `supabase/tests/rls/message_ownership_and_storage.sql`
- `supabase/tests/rls/direct_messages.sql`

The smoke command fails if required scenarios, pgTAP shape, rollback, private-feed/profile source filters, or the MVP+ hardening migration are missing. If the CLI is unavailable, structural checks pass but real execution is explicitly reported as skipped.

## Expected scenario matrix

| Actor | Operation | Expected |
| --- | --- | --- |
| Anonymous | Read public community/channel/message | Allow only when community/channel public-read rules permit |
| Anonymous | Read private community/channel/message/attachment | Deny/zero rows |
| Anonymous | Insert message | Deny |
| Authenticated visitor | Read public non-private channel/message/attachment | Allow |
| Authenticated visitor | Read private channel/message/attachment | Deny/zero rows |
| Authenticated visitor | Send/react/upload | Deny until membership and permission exist |
| Member | Read joined community and allowed channels | Allow |
| Member | Read unrelated private community | Deny/zero rows |
| Member | Manage channels/roles/reports | Deny unless granted capability |
| Moderator | Review reports/moderate allowed targets | Allow within community scope only |
| Moderator | Owner/admin-only settings or role escalation | Deny |
| Admin | Manage permitted community resources/private channels | Allow within own community only |
| Owner | Manage owned community | Allow; no access to another private community |
| DM participant | Read/send in own direct conversation | Allow |
| DM outsider | Read messages/reactions/attachments | Deny/zero rows |
| Attachment viewer | Read object/metadata in inaccessible private channel | Deny |
| Saved-message owner | Read own save only while source message remains visible | Allow/deny dynamically |
| Webhook manager | Read safe webhook metadata | Allow; `token_hash` column denied |

## Mention Feed and Profile privacy

Mention Feed and Profile are derived views, not separate authorization boundaries.

- Supabase queries must return only RLS-visible source rows.
- Mock/client UX additionally calls `canViewChannel` before rendering mentions.
- Mock profile activity/media uses `filterCommunitiesForViewer` and removes inaccessible channel messages.
- Deep links/open-in-channel must re-check destination visibility.
- A hidden item must not leak title, preview, author context, attachment URL, or channel ID.

## Manual two-account staging checks

1. Create public and private communities with public/private channels.
2. Use owner, admin, moderator, member, visitor, unrelated member, and anonymous sessions.
3. Execute select/insert/update/delete attempts through the same API client used by Picom.
4. Confirm denied reads return no rows and denied writes return stable permission errors without private detail.
5. Test private attachment signed URLs after membership loss.
6. Remove a member while two clients are connected; verify later reads/realtime joins fail.
7. Open Mention Feed/Profile as visitor and unrelated member; confirm private activity/media is absent.
8. Save a visible message, revoke channel access, then confirm the saved row is no longer selectable.
9. Attempt `select token_hash from webhooks` as a manager; expect column permission denial.
10. Record release commit, migrations, users/roles, query result, timestamp, and reviewer without tokens or message content.

## Required pass evidence

- All pgTAP plans finish with zero failures.
- No fixture persists after the test transaction.
- `npm run supabase:api-regression` passes.
- `npm run isolation:multi-tenant:smoke` passes.
- No service-role key is present in renderer source.
- Staging evidence is attached to the release go/no-go record.

## Current environment status

Supabase CLI is currently unavailable on the development workstation. Structural checks can run; real pgTAP execution must not be reported as passed until the CLI/local stack is available.
