import { useEffect, useState } from "react";
import { audioDataSource, type AudioCatalogSnapshot } from "../services/audio/audioDataSource";
import { radioRealtimeService } from "../services/audio/radioRealtimeService";
import type { RealtimeConnectionStatus } from "../services/supabase/realtimeService";

export type AudioCatalogHookState = Readonly<{ snapshot: AudioCatalogSnapshot; loading: boolean; error: string | null; realtimeStatus: RealtimeConnectionStatus }>;

export function useAudioCatalogState(): AudioCatalogHookState {
  const [snapshot, setSnapshot] = useState(() => audioDataSource.getSnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("idle");
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      setLoading(true);
      void audioDataSource.refresh().then((result) => {
        setLoading(false);
        setError(result.ok ? null : result.error.message);
      });
    };
    const unsubscribeCatalog = audioDataSource.subscribe(setSnapshot);
    const unsubscribeRealtime = radioRealtimeService.subscribe({
      onStatus: setRealtimeStatus,
      onError: setError,
      onEvent: () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 80);
      },
    });
    refresh();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribeRealtime();
      unsubscribeCatalog();
    };
  }, []);
  return { snapshot, loading, error, realtimeStatus };
}

export function useAudioCatalog(): AudioCatalogSnapshot {
  return useAudioCatalogState().snapshot;
}
