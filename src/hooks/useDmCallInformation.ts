import { useCallback, useEffect, useRef, useState } from "react";
import type { DmCall } from "../types/dmCalls";
import { dmCallService } from "../services/directMessages/dmCallService";

type DmCallInformationState = Readonly<{
  calls: readonly DmCall[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markConversationRead: (conversationId: string) => void;
}>;

export function useDmCallInformation(currentUserId: string, enabled: boolean): DmCallInformationState {
  const [calls, setCalls] = useState<readonly DmCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const refresh = useCallback(() => {
    if (!enabled || !currentUserId) return;
    const generation = ++generationRef.current;
    setLoading(true);
    void dmCallService.listCalls(undefined, 150).then((result) => {
      if (generation !== generationRef.current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setCalls(result.data);
    });
  }, [currentUserId, enabled]);

  useEffect(() => {
    if (!enabled || !currentUserId) {
      setCalls([]);
      setLoading(false);
      setError(null);
      return;
    }
    refresh();
    const offLocal = dmCallService.subscribeLocal((call) => {
      setCalls((current) => [call, ...current.filter((item) => item.id !== call.id)]
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)));
    });
    const offRealtime = dmCallService.subscribeRealtime(currentUserId, refresh);
    return () => {
      generationRef.current += 1;
      offLocal();
      offRealtime();
    };
  }, [currentUserId, enabled, refresh]);

  const markConversationRead = useCallback((conversationId: string) => {
    const unread = calls.filter((call) => call.conversationId === conversationId && call.unread);
    if (!unread.length) return;
    setCalls((current) => current.map((call) => call.conversationId === conversationId ? { ...call, unread: false } : call));
    void Promise.all(unread.map((call) => dmCallService.markRead(call.id))).then(refresh);
  }, [calls, refresh]);

  return { calls, loading, error, refresh, markConversationRead };
}
