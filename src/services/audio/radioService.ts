import type { AudioPlayableItem, RadioSession } from "../../types/audio";
import { audioDataSource, type AudioServiceResult, type StartRadioSessionInput } from "./audioDataSource";
import { audioPlayerService } from "./audioPlayerService";

function playable(session: RadioSession): AudioPlayableItem {
  return {
    id: session.id,
    type: session.status === "scheduled" ? "radio_scheduled" : "radio_live",
    title: session.title,
    contextLabel: "Community radio",
    coverUrl: session.coverUrl,
    durationSeconds: 3600,
  };
}

export const radioService = {
  getCommunityRadioSessions: (communityId: string) => audioDataSource.listRadioSessions(communityId),
  async getLiveRadioSessions(): Promise<AudioServiceResult<RadioSession[]>> {
    const result = await audioDataSource.listRadioSessions();
    return result.ok ? { ok: true, data: result.data.filter((item) => item.status === "live") } : result;
  },
  getRadioSession: (id: string) => audioDataSource.getRadioSession(id),
  startRadioSession: (payload: StartRadioSessionInput) => audioDataSource.startRadioSession(payload),
  endRadioSession: (id: string) => audioDataSource.endRadioSession(id),
  async listenToRadio(id: string) {
    const result = await audioDataSource.setListening(id, true);
    if (!result.ok) return result;
    const session = await audioDataSource.getRadioSession(id);
    if (session.ok) audioPlayerService.select(playable(session.data));
    return result;
  },
  async leaveRadio(id: string) {
    const result = await audioDataSource.setListening(id, false);
    if (result.ok && audioPlayerService.getSnapshot().item?.id === id) audioPlayerService.clear();
    return result;
  },
  saveRadio: (id: string) => audioDataSource.setRadioSaved(id, true),
  unsaveRadio: (id: string) => audioDataSource.setRadioSaved(id, false),
  reactToRadio: (id: string, emoji: string) => audioDataSource.reactToRadioSession(id, emoji),
};
