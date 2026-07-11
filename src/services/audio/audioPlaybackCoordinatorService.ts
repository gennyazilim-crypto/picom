import type { AudioPlayableItem, PodcastEpisode } from "../../types/audio";
import { audioDataSource } from "./audioDataSource";
import { audioPlayerService } from "./audioPlayerService";
import { radioRepository } from "./radioRepository";

export type AudioPlaybackCoordinatorResult = Readonly<
  | { ok: true }
  | { ok: false; error: { code: "AUDIO_REQUEST_FAILED"; message: string } }
>;

const isRadio = (item: AudioPlayableItem | null) => item?.type === "radio_live" || item?.type === "radio_scheduled";

function podcastPlayable(episode: PodcastEpisode, selected: AudioPlayableItem): AudioPlayableItem {
  return {
    id: episode.id,
    type: "podcast_episode",
    title: episode.title,
    contextLabel: episode.id === selected.id ? selected.contextLabel : "Podcast episode",
    coverUrl: episode.coverUrl,
    audioUrl: episode.audioUrl,
    durationSeconds: episode.durationSeconds,
    communityId: episode.communityId,
  };
}

async function resolvePodcastQueue(item: AudioPlayableItem, provided?: readonly AudioPlayableItem[]): Promise<readonly AudioPlayableItem[]> {
  if (provided?.length) return provided;
  const result = await audioDataSource.listPodcastEpisodes(item.communityId);
  if (!result.ok) return [item];
  const queue = result.data
    .filter((episode) => episode.status === "published" && Boolean(episode.audioUrl))
    .map((episode) => podcastPlayable(episode, item));
  return queue.some((candidate) => candidate.id === item.id) ? queue : [item, ...queue];
}

export const audioPlaybackCoordinatorService = {
  async select(item: AudioPlayableItem, queue?: readonly AudioPlayableItem[]): Promise<AudioPlaybackCoordinatorResult> {
    const current = audioPlayerService.getSnapshot().item;
    if (current && (current.id !== item.id || current.type !== item.type) && isRadio(current)) {
      const leave = await radioRepository.leave(current.id);
      if (!leave.ok) return { ok: false, error: { code: "AUDIO_REQUEST_FAILED", message: leave.error.message } };
    }
    const resolvedQueue = item.type === "podcast_episode" ? await resolvePodcastQueue(item, queue) : [item];
    const refreshedItem = resolvedQueue.find((candidate) => candidate.id === item.id) ?? item;
    audioPlayerService.select(refreshedItem, resolvedQueue);
    return { ok: true };
  },
  async stopCurrent(): Promise<AudioPlaybackCoordinatorResult> {
    const current = audioPlayerService.getSnapshot().item;
    if (isRadio(current) && current) {
      const leave = await radioRepository.leave(current.id);
      if (!leave.ok) return { ok: false, error: { code: "AUDIO_REQUEST_FAILED", message: leave.error.message } };
    }
    audioPlayerService.clear();
    return { ok: true };
  },
};
