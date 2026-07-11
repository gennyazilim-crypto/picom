# Typed Community Invite and Join Flow

Picom invite and public-join flows preserve the canonical community kind from preview through landing.

## Preview

`get_community_invite_preview` validates a high-entropy invite code and returns only safe metadata: community id, name, kind, description, visibility, aggregate member count, and expiry. It never returns the invite code, private channels, role internals, or member identities.

The desktop preview identifies Text, Radio, or Podcast and explains the relevant capabilities before the user confirms membership.

## Landing destinations

- Text opens `welcome`, then `general`, then the first readable text channel.
- Radio opens the station shell at Live and Schedule.
- Podcast opens the library shell at Episodes.

The same resolver is used by public join and invite acceptance. Existing community/channel state remains preserved for later switching.

## Access controls

- Public join remains limited to public communities.
- Private communities require a valid invite or a future approval path.
- Active community bans reject every membership insert.
- A blocking relationship between the user and community owner rejects every membership insert.
- Supabase triggers are authoritative; local checks provide immediate mock-mode feedback only.

Run `npm run community:typed-join:smoke`. Run `supabase test db --file supabase/tests/rls/typed_community_invite_join.sql` only against an isolated local or staging database.
