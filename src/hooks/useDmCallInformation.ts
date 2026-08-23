import { useCallback, useEffect, useRef, useState } from "react";
import type { DmCall } from "../types/dmCalls";
import { dmCallService } from "../services/directMessages/dmCallService";

type DmCallInformationState = Readonly<{
  calls: readonly DmCall[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markConversationRead: (conversationId: string) => void;
  dismissCall: (callId: string) => Promise<string | null>;
}>;

function mergeCall(current: readonly DmCall[], call: DmCall): DmCall[] {
  return [call, ...current.filter((item) => item.id !== call.id)]
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

export function useDmCallInformation(currentUserId: string, enabled: boolean, activeConversationId?: string): DmCallInformationState {
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

  const ingestCallId = useCallback((callId?: string) => {
    if (!enabled || !currentUserId) return;
    if (!callId) {
      refresh();
      return;
    }
    void dmCallService.getCall(callId).then((result) => {
      if (result.ok && result.data) {
        setCalls((current) => mergeCall(current, result.data));
        return;
      }
      refresh();
    });
  }, [currentUserId, enabled, refresh]);

  useEffect(() => {
    if (!enabled || !currentUserId) {
      setCalls([]);
      setLoading(false);
      setError(null);
      return;
    }
    refresh();
    const offLocal = dmCallService.subscribeLocal((call) => {
      setCalls((current) => mergeCall(current, call));
    });
    const offRealtime = dmCallService.subscribeRealtime(currentUserId, ingestCallId);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      generationRef.current += 1;
      offLocal();
      offRealtime();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [currentUserId, enabled, ingestCallId, refresh]);

  useEffect(() => {
    if (!enabled || !currentUserId || !activeConversationId) return;
    refresh();
  }, [activeConversationId, currentUserId, enabled, refresh]);

  const markConversationRead = useCallback((conversationId: string) => {
    const unread = calls.filter((call) => call.conversationId === conversationId && call.unread);
    if (!unread.length) return;
    setCalls((current) => current.map((call) => call.conversationId === conversationId ? { ...call, unread: false } : call));
    void Promise.all(unread.map((call) => dmCallService.markRead(call.id))).then(refresh);
  }, [calls, refresh]);

  const dismissCall = useCallback(async (callId: string): Promise<string | null> => {
    const previous = calls;
    setCalls((current) => current.filter((call) => call.id !== callId));
    const result = await dmCallService.hideCall(callId);
    if (result.ok && result.data) {
      setError(null);
      return null;
    }
    setCalls(previous);
    const message = result.ok ? "This call could not be removed from your history." : result.error.message;
    setError(message);
    refresh();
    return message;
  }, [calls, refresh]);

  return { calls, loading, error, refresh, markConversationRead, dismissCall };
}
