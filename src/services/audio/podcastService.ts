import type { AudioPlayableItem } from "../../types/audio";
import { audioDataSource } from "./audioDataSource";
import { audioPlaybackCoordinatorService } from "./audioPlaybackCoordinatorService";

export const podcastService = {
  getCommunityPodcastEpisodes: (communityId: string) => audioDataSource.listPodcastEpisodes(communityId),
  getUserPodcastEpisodes: (userId: string) => audioDataSource.listPodcastEpisodes(undefined, userId),
  getPodcastEpisode: (id: string) => audioDataSource.getPodcastEpisode(id),
  async playPodcastEpisode(id: string) {
    const result = await audioDataSource.getPodcastEpisode(id);
    if (!result.ok) return result;
    const episode = result.data;
    const item: AudioPlayableItem = {
      id: episode.id,
      type: "podcast_episode",
      title: episode.title,
      contextLabel: "Podcast episode",
      coverUrl: episode.coverUrl,
      audioUrl: episode.audioUrl,
      durationSeconds: episode.durationSeconds,
      communityId: episode.communityId,
    };
    const selected = await audioPlaybackCoordinatorService.select(item);
    if (!selected.ok) return selected;
    return result;
  },
  savePodcastEpisode: (id: string) => audioDataSource.setPodcastSaved(id, true),
  unsavePodcastEpisode: (id: string) => audioDataSource.setPodcastSaved(id, false),
  reactToPodcastEpisode: (id: string, emoji: string) => audioDataSource.reactToPodcastEpisode(id, emoji),
  commentOnPodcastEpisode: (id: string, body: string) => audioDataSource.commentOnPodcastEpisode(id, body),
};
