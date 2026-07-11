# Podcast Full MVP data model and storage

## Domain ownership

Podcast settings, series, and episodes are accepted only for communities whose immutable kind is `podcast`. Series references must belong to the same community as their episodes. Publishers create and publish episodes; Podcast editors may update metadata but the database trigger prevents them from changing media, author/host, or publication state without `publishPodcasts`.

## Episode lifecycle

Episodes support `draft`, `published`, and `archived`. Public/member readers see only published episodes allowed by community access. Authors and authorized Podcast managers may inspect drafts. A new publication transition requires a publish date, positive duration, and a validated private `podcast-audio` object path.

Metadata includes author, optional host, series, cover path, audio path, MIME type, byte size, duration, explicit flag, tags, and publish date. Optional chapters were not present in the approved design and are intentionally not introduced by this task. RSS, transcoding, and transcripts remain outside Full MVP.

## Private media

- `podcast-audio`: private, 100 MiB maximum; MPEG, MP4 audio, Ogg, WAV, and WebM audio only.
- `audio-covers`: private, 5 MiB maximum; PNG, JPEG, WebP, and GIF only.
- Object paths bind community ID and episode/series ID. Storage helpers verify both identifiers and RLS visibility/management before read or write.
- Renderer components never receive permanent private object URLs. `audioDataSource` resolves one-hour signed URLs after metadata is authorized.

## Social and progress state

Existing saves, reactions, and comments remain RLS-protected. Comment replies can reference only a non-deleted comment in the same episode. `podcast_playback_progress` stores private per-user resume/completion state with owner-only RLS and episode visibility checks.

## Validation

Run `npm run podcast:data-model:smoke`, `npm run audio:schema:smoke`, and `npm run supabase:rls:smoke`. Real pgTAP execution still requires the local Supabase CLI or a protected staging workflow.
