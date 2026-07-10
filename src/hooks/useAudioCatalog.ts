import { useEffect, useState } from "react";
import { audioDataSource, type AudioCatalogSnapshot } from "../services/audio/audioDataSource";

export function useAudioCatalog(): AudioCatalogSnapshot {
  const [snapshot, setSnapshot] = useState(() => audioDataSource.getSnapshot());
  useEffect(() => {
    const unsubscribe = audioDataSource.subscribe(setSnapshot);
    void audioDataSource.refresh();
    return unsubscribe;
  }, []);
  return snapshot;
}
