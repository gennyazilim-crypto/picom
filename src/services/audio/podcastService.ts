import type { AudioPlayableItem } from "../../types/audio";
import { audioDataSource } from "./audioDataSource";
import { audioPlaybackCoordinatorService } from "./audioPlaybackCoordinatorService";
import { podcastProgressService } from "./podcastProgressService";

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
  removePodcastReaction: (id: string, emoji: string) => audioDataSource.removePodcastReaction(id, emoji),
  commentOnPodcastEpisode: (id: string, body: string, replyToCommentId?: string) => audioDataSource.commentOnPodcastEpisode(id, body, replyToCommentId),
  editPodcastComment: (episodeId: string, commentId: string, body: string) => audioDataSource.editPodcastComment(episodeId, commentId, body),
  deletePodcastComment: (episodeId: string, commentId: string) => audioDataSource.deletePodcastComment(episodeId, commentId),
  moderatePodcastComment: (commentId: string, reason: string) => audioDataSource.moderatePodcastComment(commentId, reason),
  moderatePodcastEpisode: (id: string, action: "unpublish" | "archive", reason: string) => audioDataSource.moderatePodcastEpisode(id, action, reason),
  getPlaybackProgress: (id: string) => podcastProgressService.get(id),
  savePlaybackProgress: (id: string, positionSeconds: number, durationSeconds: number) => podcastProgressService.save({ episodeId: id, positionSeconds, durationSeconds }),
  clearPlaybackProgress: (id: string) => podcastProgressService.clear(id),
  markPodcastEpisodeListened: (id: string, durationSeconds: number) => podcastProgressService.save({ episodeId: id, positionSeconds: durationSeconds, durationSeconds }),
  markPodcastEpisodeUnlistened: (id: string) => podcastProgressService.clear(id),
};
