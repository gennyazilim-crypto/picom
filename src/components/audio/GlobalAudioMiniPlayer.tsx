import { useEffect } from "react";
import { useAudioCatalogState } from "../../hooks/useAudioCatalog";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { audioPlayerService } from "../../services/audio/audioPlayerService";
import { audioPlaybackCoordinatorService } from "../../services/audio/audioPlaybackCoordinatorService";
import { radioService } from "../../services/audio/radioService";
import { AudioMiniPlayer } from "./AudioMiniPlayer";

export function GlobalAudioMiniPlayer() {
  const player = useAudioPlayer();
  const catalog = useAudioCatalogState();

  useEffect(() => {
    const item = player.item;
    if (!item || item.type !== "radio_live" || catalog.loading) return;
    const session = catalog.snapshot.radioSessions.find((candidate) => candidate.id === item.id);
    if (!session || session.status === "ended" || session.status === "cancelled") {
      audioPlayerService.markEnded(session?.status === "cancelled" ? "This broadcast was cancelled." : "This broadcast has ended.");
    }
  }, [catalog.loading, catalog.snapshot.radioSessions, player.item]);

  useEffect(() => {
    const item = player.item;
    if (!item || item.type !== "radio_live" || ["idle", "ended", "error"].includes(player.status)) return;
    const heartbeat = () => { void radioService.heartbeatRadioListener(item.id); };
    heartbeat();
    const timer = window.setInterval(heartbeat, 25_000);
    return () => window.clearInterval(timer);
  }, [player.item, player.status]);

  useEffect(() => {
    const dispose = () => audioPlayerService.dispose();
    window.addEventListener("beforeunload", dispose);
    return () => {
      window.removeEventListener("beforeunload", dispose);
      void audioPlaybackCoordinatorService.stopCurrent();
    };
  }, []);

  if (!player.item) return null;
  return <div className="global-audio-dock"><AudioMiniPlayer /></div>;
}
