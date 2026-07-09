# Picom Production RLS Verification

Use separate synthetic accounts for anonymous, visitor, member, moderator, admin, and owner states. Never test end-user policy behavior with a service-role client.

## Safe execution model

- Run transaction/fixture pgTAP SQL only against local or isolated staging databases.
- Use `npm run supabase:rls:test` after installing Supabase CLI.
- Do not insert fixture rows into production through the SQL tests in `supabase/tests/rls`; they explicitly target disposable environments.
- In production, use approved pre-created synthetic smoke accounts/community/channel data and normal anon/authenticated client paths.
- Record allow/deny outcomes without copying private content.

## Access matrix

| Actor | Public community/channel | Private community/channel | Message write | Moderation/settings | Attachments |
| --- | --- | --- | --- | --- | --- |
| Anonymous | Read only when community/channel public-read flags allow | Denied | Denied | Denied | Public visible attached objects only |
| Visitor | Same public read behavior | Denied | Denied | Denied | Same visibility as readable message/channel |
| Member | Read/write allowed joined channels | Only explicitly permitted private channels | Allowed only with membership/send permission in text channel | Denied | Upload/read only through allowed message/channel flow |
| Moderator | Member access | Permission-dependent | Member write | Moderate only granted scope; cannot grant self admin/owner | Same visibility plus explicitly granted moderation path |
| Admin | Permission-dependent private access | Allowed by assigned role | Allowed | Manage permitted community settings/roles/members | Same message/channel visibility |
| Owner | Full community scope | Allowed | Allowed | Full community management and ownership-sensitive actions | Full community moderation scope subject to policy |

## Manual scenario checklist

### Anonymous and visitor

- [ ] Anonymous cannot list private community metadata.
- [ ] Anonymous/visitor can read a public community only when `visibility=public` and `public_read_enabled=true`.
- [ ] Visitor can read only non-private channels with channel public read enabled.
- [ ] Visitor cannot query private channel, message, reaction, read state, member-private data, or attachment metadata.
- [ ] Visitor cannot insert/update/delete messages, reactions, attachments, channels, roles, or privileged memberships.
- [ ] Public self-join creates only the default Member relationship and cannot select an elevated role.

### Member

- [ ] Member reads joined/visible channels and sends only when `sendMessages` is allowed.
- [ ] Member cannot read a private channel without explicit permission.
- [ ] Member cannot create/manage channels, roles, or higher memberships.
- [ ] Author can edit/delete own message only within policy limits.
- [ ] Other member cannot edit/delete another author’s content.

### Moderator, admin, and owner

- [ ] Moderator actions are limited to granted moderation permissions.
- [ ] Moderator cannot grant admin/owner or change owner-only settings.
- [ ] Admin can manage only permissions granted by the role policy.
- [ ] Admin cannot transfer ownership unless an explicit owner-authorized path exists.
- [ ] Owner can manage channels and perform permitted community moderation.
- [ ] Lower roles cannot modify or assign equal/higher roles.

### Attachments and Storage

- [ ] Attachment metadata follows the parent message/channel visibility.
- [ ] Private message object paths cannot be downloaded by visitor/unauthorized member.
- [ ] Pending upload metadata/object is visible only to its uploader and approved server path.
- [ ] Losing channel access removes future object access; stale direct URLs do not bypass policy.
- [ ] Upload insert is denied when message send/upload permission is denied.

### Mention Feed and Profile activity

- [ ] Mention Feed queries return only messages/channels visible to the current account.
- [ ] Popular/following tabs do not expose private community names, channel names, snippets, images, commenter identities, or counts.
- [ ] Open-in-channel returns a safe unavailable/join-required state when access changed.
- [ ] Profile activity/shared media omits private content from communities the viewer cannot access.
- [ ] Realtime mention events are filtered by the same database visibility rules.

## Policy metadata queries

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

Review results for unexpected `anon` grants, permissive `true` predicates, missing `with check`, and policy gaps. Do not paste full policy dumps containing production identifiers into public issues.

## Expected local commands

```powershell
npm run supabase:rls:production-safe
npm run supabase:rls:smoke
npm run supabase:rls:test
```

If Supabase CLI is missing, install it using an official method and rerun. Static smoke success is not proof of deployed RLS behavior.

## Release gate

Any unexpected allow is a blocker. Unexpected denies affecting login, public read, member messaging, or owner administration are at least critical until impact is understood. Store account IDs, timestamps, request IDs, and redacted results in the private release evidence; never store passwords, tokens, or private message content.
