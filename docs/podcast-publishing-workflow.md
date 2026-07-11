# Podcast publishing workflow

Picom's Podcast publisher is a desktop-only, service-backed workflow. Listener surfaces continue to show only published episodes, while Publishers and Editors can open the private drafts and archive workspace.

## Roles

- **Owner / manageCommunity:** can edit metadata and run every publishing action.
- **Podcast Publisher / publishPodcasts:** can create drafts, upload or replace private media, publish, unpublish, archive, and delete eligible episodes.
- **Podcast Editor / editPodcastMetadata:** can open private drafts and edit metadata. Editors cannot upload media or change publication state unless they also have Publisher permission.
- **Listener:** can access published episodes only.

Frontend checks provide a clear user experience. Supabase RLS and private Storage policies remain the authority for every write.

## Episode lifecycle

1. A Publisher creates a private draft with a required title.
2. A Publisher or Editor may save metadata, including description, series, tags, and the explicit-content flag.
3. A Publisher uploads a validated cover and audio file to private Storage.
4. Picom resolves a short-lived signed URL for preview and records managed Storage metadata on the episode.
5. Publish is enabled only after the episode has a title, valid audio, and a positive duration.
6. A published episode may be unpublished back to draft or archived after confirmation.
7. Published episodes cannot be deleted directly. They must first be unpublished or archived.
8. Delete removes managed media before removing the eligible episode record.

## Validation and errors

- Audio accepts MP3, M4A, OGG, WAV, and WebM up to 100 MiB.
- Cover art accepts PNG, JPEG, WebP, and GIF up to 5 MiB.
- Browser metadata inspection rejects unreadable or zero-duration audio before publication.
- Upload, permission, validation, and cancellation failures remain visible in the publisher workspace.
- Failed uploads retain an explicit Retry action.
- Destructive publication changes require a desktop confirmation dialog.

## Upload progress and cancellation

The UI reports deterministic stages: validation, upload, finalization, and completion. Supabase Storage does not currently expose byte-level progress or an abort signal through the client used by Picom, so percentages represent stages rather than fabricated transferred-byte counts. Cancellation is checked before and after the network upload; if cancellation occurs after an object is created, Picom removes that object before returning a canceled result.

## Mock and Supabase modes

Mock mode uses the same service API and lifecycle rules with local state and object URLs. Supabase mode uses the authenticated service layer, private `podcast-audio` and `podcast-covers` buckets, signed preview URLs, and RLS-backed episode writes. React components never call `supabase.from` directly.

## Deferred work

RSS distribution, transcoding, waveform generation, transcript processing, analytics, and public media URLs are outside this Full MVP workflow.
