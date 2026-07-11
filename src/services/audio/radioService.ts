import type { AudioPlayableItem, RadioSession } from "../../types/audio";
import { audioDataSource, type AudioServiceResult, type StartRadioSessionInput } from "./audioDataSource";
import { audioPlayerService } from "./audioPlayerService";
import { audioPlaybackCoordinatorService } from "./audioPlaybackCoordinatorService";
import { radioRepository } from "./radioRepository";

function playable(session: RadioSession): AudioPlayableItem {
  return {
    id: session.id,
    type: session.status === "scheduled" ? "radio_scheduled" : "radio_live",
    title: session.title,
    contextLabel: "Community radio",
    coverUrl: session.coverUrl,
    audioUrl: session.streamUrl,
    durationSeconds: 3600,
    communityId: session.communityId,
    isLive: session.status === "live",
  };
}

export const radioService = {
  getCommunityRadioSessions: (communityId: string) => radioRepository.list({ communityId }),
  getScheduledRadioSessions: (communityId?: string) => radioRepository.list({ communityId, statuses: ["draft", "scheduled"] }),
  getEndedRadioSessions: (communityId?: string) => radioRepository.list({ communityId, statuses: ["ended", "cancelled"] }),
  async getLiveRadioSessions(): Promise<AudioServiceResult<RadioSession[]>> {
    const result = await audioDataSource.listRadioSessions();
    return result.ok ? { ok: true, data: result.data.filter((item) => item.status === "live") } : result;
  },
  getRadioSession: (id: string) => radioRepository.get(id),
  startRadioSession: (payload: StartRadioSessionInput) => radioRepository.create(payload),
  updateRadioSchedule: (id: string, input: Parameters<typeof audioDataSource.updateRadioSchedule>[1]) => radioRepository.updateSchedule(id, input),
  cancelRadioSchedule: (id: string) => radioRepository.cancelSchedule(id),
  goLive: (id: string) => radioRepository.start(id),
  endRadioSession: (id: string) => radioRepository.end(id),
  async listenToRadio(id: string) {
    const current = audioPlayerService.getSnapshot().item;
    if (current && current.id !== id) {
      const stopped = await audioPlaybackCoordinatorService.stopCurrent();
      if (!stopped.ok) return stopped;
    }
    const result = await radioRepository.join(id);
    if (!result.ok) return result;
    const session = await audioDataSource.getRadioSession(id);
    if (!session.ok) {
      await radioRepository.leave(id);
      return session;
    }
    audioPlayerService.select(playable(session.data));
    return result;
  },
  heartbeatRadioListener: (id: string) => radioRepository.heartbeat(id),
  async leaveRadio(id: string) {
    const result = await radioRepository.leave(id);
    if (result.ok && audioPlayerService.getSnapshot().item?.id === id) audioPlayerService.clear();
    return result;
  },
  saveRadio: (id: string) => radioRepository.setSaved(id, true),
  unsaveRadio: (id: string) => radioRepository.setSaved(id, false),
  reactToRadio: (id: string, emoji: string) => radioRepository.react(id, emoji),
  assignRadioHost: (input: Parameters<typeof audioDataSource.assignRadioSessionHost>[0]) => radioRepository.assignHost(input),
  getRadioListeners: (id: string) => radioRepository.listListeners(id),
  moderateRadioListener: (id: string, userId: string, action: Parameters<typeof audioDataSource.moderateRadioListener>[2]) => radioRepository.moderateListener(id, userId, action),
};
