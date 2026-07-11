import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const dataSource = read("src/services/audio/audioDataSource.ts");
const publishingService = read("src/services/audio/podcastPublishingService.ts");
const publisherPanel = read("src/components/audio/PodcastPublisherPanel.tsx");
const podcastShell = read("src/components/audio/PodcastCommunityShell.tsx");
const app = read("src/App.tsx");
const migration = read("supabase/migrations/20260711001600_podcast_full_mvp_data_model_storage.sql");

for (const token of [
  "createPodcastDraft",
  "updatePodcastMetadata",
  "updatePodcastMedia",
  "publishPodcastEpisode",
  "unpublishPodcastEpisode",
  "archivePodcastEpisode",
  "deletePodcastEpisode",
]) {
  if (!dataSource.includes(token)) throw new Error(`Podcast data-source lifecycle operation missing: ${token}`);
}

for (const token of [
  "audio/mpeg",
  "image/webp",
  "AbortSignal",
  'storage.from(bucket).upload',
  "createSignedUrl",
  'report(input.onProgress, "uploading"',
  ".remove([",
]) {
  if (!publishingService.includes(token)) throw new Error(`Podcast publishing safety contract missing: ${token}`);
}

for (const token of [
  "Save draft",
  "Publish",
  "Unpublish",
  "Archive",
  "Delete",
  "Retry upload",
  "Cancel upload",
  "Private preview",
  "podcastPublishingService.uploadMedia",
]) {
  if (!publisherPanel.includes(token)) throw new Error(`Podcast publisher UI contract missing: ${token}`);
}

if (!/<audio\s+controls/.test(publisherPanel)) throw new Error("Podcast private audio preview is not connected to a native audio control.");
if (/supabase\s*\.\s*from\s*\(/.test(publisherPanel)) throw new Error("Podcast publisher UI bypasses the service layer.");
if (!podcastShell.includes("canPublish") || !podcastShell.includes("canEdit") || !podcastShell.includes("PodcastPublisherPanel")) throw new Error("Podcast Publisher and Editor access are not separated in the community shell.");
if (!app.includes('permissions.includes("publishPodcasts")') || !app.includes('permissions.includes("editPodcastMetadata")')) throw new Error("Podcast publisher/editor capability wiring is missing at the application boundary.");
if (app.includes('["Podcast Publisher", "Podcast Editor"].includes')) throw new Error("Podcast access must not fall back to UI role-name matching.");
if (!migration.includes("can_manage_podcast_episode") || !migration.includes("podcast audio writers update authorized episode objects")) throw new Error("Podcast publishing is not backed by the private-media permission migration.");

console.log("Podcast draft, private media, publish, unpublish, archive, delete, and permission workflow contract passed.");
