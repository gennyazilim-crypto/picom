# Audio Supabase Schema and Storage Plan

## Scope

This foundation covers Picom community radio metadata, podcast episodes, reactions, comment previews, saved audio, and private storage. It does not enable LiveKit broadcasting or connect the renderer directly to Supabase.

## Tables

- `radio_sessions`: community/channel-scoped scheduled, live, ended, or cancelled sessions.
- `radio_listeners`: active and historical listener presence. A partial unique index permits one active row per user/session.
- `podcast_episodes`: draft, published, and archived episode metadata.
- `podcast_episode_reactions`: one reaction per episode, user, and emoji.
- `podcast_episode_comments`: safe text comments with soft-delete metadata.
- `saved_audio_items`: private user bookmarks for radio sessions or podcast episodes.

Foreign keys use cascade only for community-owned child data. Profile references use `restrict` for primary authored records and `set null` for comment attribution that may be anonymized.

## Access Model

`can_view_community_audio()` follows existing community and channel access helpers:

- Members may read audio in communities and channels they can view.
- Authenticated visitors may read published audio only when the community is public with public read enabled.
- Channel-scoped visitor access additionally requires a non-private, public-readable channel.
- Private community or channel audio is never exposed through a public URL.
- Draft/archived podcasts are visible only to their author or permitted audio managers.

`can_manage_community_audio()` accepts existing owner/admin/moderator roles and explicit `hostRadio` or `publishPodcasts` permission keys. The frontend role check remains UX only; RLS is authoritative.

## Write Boundaries

- Radio creation requires the authenticated user to be the host and have host permission.
- Podcast creation requires the authenticated user to be the author and have publish permission.
- Authors/hosts and permitted community managers can update or delete their records.
- Reactions and comments require authenticated community membership; public visitors remain read-only.
- Saved audio rows are private and can only be created/deleted by their owner for visible audio.

## Private Storage

Both buckets are intentionally private:

- `podcast-audio`: maximum 100 MiB, common audio MIME types only.
- `audio-covers`: maximum 5 MiB, PNG/JPEG/WebP/GIF only.

Required object paths:

```text
communities/{communityId}/podcasts/{episodeId}/audio/{objectId}.mp3
communities/{communityId}/podcasts/{episodeId}/covers/{objectId}.webp
communities/{communityId}/radio/{sessionId}/covers/{objectId}.webp
```

Storage policies resolve the episode/session id from the path and call the same view/manage helpers as table RLS. Production clients should use short-lived signed URLs after an authorized metadata query; raw public bucket URLs are prohibited.

## Manual RLS Verification

Run against a disposable local/staging Supabase project with owner, member, authenticated visitor, and unrelated-user fixtures:

1. Confirm a member can select public community audio.
2. Confirm a visitor can select a published public episode when public read is enabled.
3. Confirm that visitor cannot insert reactions/comments or listener rows.
4. Confirm an unrelated user cannot select private community or private-channel radio.
5. Confirm a normal member without audio permission cannot insert radio/podcast rows.
6. Confirm a permitted host/publisher can create only rows attributed to their own user id.
7. Confirm an author cannot update another author's episode.
8. Confirm saved audio rows are invisible to other users.
9. Confirm storage objects cannot be selected when their episode/session is inaccessible.
10. Confirm both storage buckets report `public = false`.

Do not run destructive RLS tests against production.
