import type { AudioPlayableItem } from "../../types/audio";
import { audioPlayerService } from "./audioPlayerService";
import { radioRepository } from "./radioRepository";

export type AudioPlaybackCoordinatorResult = Readonly<
  | { ok: true }
  | { ok: false; error: { code: "AUDIO_REQUEST_FAILED"; message: string } }
>;

const isRadio = (item: AudioPlayableItem | null) => item?.type === "radio_live" || item?.type === "radio_scheduled";

export const audioPlaybackCoordinatorService = {
  async select(item: AudioPlayableItem): Promise<AudioPlaybackCoordinatorResult> {
    const current = audioPlayerService.getSnapshot().item;
    if (current && (current.id !== item.id || current.type !== item.type) && isRadio(current)) {
      const leave = await radioRepository.leave(current.id);
      if (!leave.ok) return { ok: false, error: { code: "AUDIO_REQUEST_FAILED", message: leave.error.message } };
    }
    audioPlayerService.select(item);
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
