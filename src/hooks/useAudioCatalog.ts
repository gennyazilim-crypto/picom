import { useCallback, useEffect, useState } from "react";
import { audioDataSource, type AudioCatalogSnapshot } from "../services/audio/audioDataSource";
import { radioRealtimeService } from "../services/audio/radioRealtimeService";
import { podcastRealtimeService } from "../services/audio/podcastRealtimeService";
import type { RealtimeConnectionStatus } from "../services/supabase/realtimeService";

export type AudioCatalogHookState = Readonly<{ snapshot: AudioCatalogSnapshot; loading: boolean; error: string | null; realtimeStatus: RealtimeConnectionStatus; refresh: () => Promise<void> }>;

export function useAudioCatalogState(): AudioCatalogHookState {
  const [snapshot, setSnapshot] = useState(() => audioDataSource.getSnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("idle");
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await audioDataSource.refresh();
    setLoading(false);
    setError(result.ok ? null : result.error.message);
  }, []);
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribeCatalog = audioDataSource.subscribe(setSnapshot);
    let radioStatus: RealtimeConnectionStatus = "idle";
    let podcastStatus: RealtimeConnectionStatus = "idle";
    const publishRealtimeStatus = () => {
      const values = [radioStatus, podcastStatus];
      setRealtimeStatus(values.includes("reconnecting") ? "reconnecting" : values.includes("connecting") ? "connecting" : values.includes("connected") ? "connected" : values.includes("disconnected") ? "disconnected" : "idle");
    };
    const onEvent = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 80);
    };
    const unsubscribeRadioRealtime = radioRealtimeService.subscribe({
      onStatus: (status) => { radioStatus = status; publishRealtimeStatus(); },
      onError: setError,
      onEvent,
    });
    const unsubscribePodcastRealtime = podcastRealtimeService.subscribe({
      onStatus: (status) => { podcastStatus = status; publishRealtimeStatus(); },
      onError: setError,
      onEvent,
    });
    refresh();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribeRadioRealtime();
      unsubscribePodcastRealtime();
      unsubscribeCatalog();
    };
  }, [refresh]);
  return { snapshot, loading, error, realtimeStatus, refresh };
}

export function useAudioCatalog(): AudioCatalogSnapshot {
  return useAudioCatalogState().snapshot;
}
