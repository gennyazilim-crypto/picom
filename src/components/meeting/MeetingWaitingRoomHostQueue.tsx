import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { meetingWaitingRoomRealtimeService } from "../../services/meeting/meetingWaitingRoomRealtimeService";
import { meetingWaitingRoomService } from "../../services/meeting/meetingWaitingRoomService";
import type { RealtimeConnectionStatus } from "../../services/supabase/realtimeService";
import type { MeetingWaitingEntry } from "../../types/meetingWaitingRoom";
import { AppIcon } from "../AppIcon";

type Decision = "admit" | "deny";

const byRequestedAt = (left: MeetingWaitingEntry, right: MeetingWaitingEntry) =>
  Date.parse(left.requestedAt) - Date.parse(right.requestedAt);

function requestTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Request time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function reconcileEntry(current: readonly MeetingWaitingEntry[], entry: MeetingWaitingEntry, eventType: "INSERT" | "UPDATE" | "DELETE"): readonly MeetingWaitingEntry[] {
  const withoutEntry = current.filter((item) => item.id !== entry.id);
  if (eventType === "DELETE" || entry.status !== "waiting") return withoutEntry;
  return [...withoutEntry, entry].sort(byRequestedAt);
}

export function MeetingWaitingRoomHostQueue({ roomId, canAdmit, query }: { roomId: string | null; canAdmit: boolean; query: string }) {
  const [waiting, setWaiting] = useState<readonly MeetingWaitingEntry[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("idle");
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Decision | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const busyKeysRef = useRef(new Set<string>());

  const reconcile = useCallback(async () => {
    if (!roomId || !canAdmit) return;
    const result = await meetingWaitingRoomService.list(roomId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setWaiting(result.data.filter((entry) => entry.status === "waiting").sort(byRequestedAt));
    setError("");
  }, [canAdmit, roomId]);

  useEffect(() => {
    if (!roomId || !canAdmit) {
      setWaiting([]);
      setRealtimeStatus("idle");
      return;
    }
    let active = true;
    void reconcile();
    const unsubscribe = meetingWaitingRoomRealtimeService.subscribe(roomId, {
      onEvent: ({ entry, eventType }) => {
        if (active) setWaiting((current) => reconcileEntry(current, entry, eventType));
      },
      onStatus: (status) => {
        if (!active) return;
        setRealtimeStatus(status);
        if (status === "connected") void reconcile();
      },
      onError: (message) => { if (active) setError(message); },
    });
    const reconciliationTimer = window.setInterval(() => { if (active) void reconcile(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(reconciliationTimer);
      unsubscribe();
    };
  }, [canAdmit, reconcile, roomId]);

  const visibleWaiting = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return waiting;
    return waiting.filter((entry) => `${entry.displayName} ${entry.requestedRole} ${entry.requestMessage}`.toLowerCase().includes(normalized));
  }, [query, waiting]);

  const runLocked = async <T,>(key: string, operation: () => Promise<T>): Promise<T | null> => {
    if (busyKeysRef.current.has(key)) return null;
    busyKeysRef.current.add(key);
    setBusyKeys(new Set(busyKeysRef.current));
    setError("");
    try {
      return await operation();
    } finally {
      busyKeysRef.current.delete(key);
      setBusyKeys(new Set(busyKeysRef.current));
    }
  };

  const resolveOne = async (entry: MeetingWaitingEntry, decision: Decision) => {
    const result = await runLocked(entry.id, () => meetingWaitingRoomService.resolve(entry.id, decision));
    if (!result) return;
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setWaiting((current) => reconcileEntry(current, result.data, "UPDATE"));
    setAnnouncement(`${entry.displayName} was ${decision === "admit" ? "admitted" : "denied"}.`);
  };

  const resolveAll = async (decision: Decision) => {
    if (!roomId || !waiting.length) return;
    const result = await runLocked(`bulk-${decision}`, () => meetingWaitingRoomService.resolveAll(roomId, decision));
    if (!result) return;
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const resolvedIds = new Set(result.data.entries.map((entry) => entry.id));
    setWaiting((current) => current.filter((entry) => !resolvedIds.has(entry.id)));
    setAnnouncement(`${result.data.affected} waiting ${result.data.affected === 1 ? "person was" : "people were"} ${decision === "admit" ? "admitted" : "denied"}.`);
    setConfirmation(null);
    await reconcile();
  };

  if (!canAdmit || !roomId) return null;

  return <section className="meeting-waiting-queue" aria-labelledby="meeting-waiting-title">
    <header>
      <span>
        <span className="meeting-waiting-queue__title"><AppIcon name="users" size="xs" /><strong id="meeting-waiting-title">Waiting room</strong><b>{waiting.length}</b></span>
        <small>{realtimeStatus === "connected" ? "Live queue" : realtimeStatus === "reconnecting" ? "Reconnecting" : "Syncing queue"}</small>
      </span>
      {waiting.length ? <span className="meeting-waiting-queue__bulk">
        <button type="button" disabled={busyKeys.size > 0} onClick={() => setConfirmation("admit")}>Admit all</button>
        <button type="button" className="is-danger" disabled={busyKeys.size > 0} onClick={() => setConfirmation("deny")}>Deny all</button>
      </span> : null}
    </header>
    {error ? <p className="meeting-dock-error" role="alert">{error}</p> : null}
    <p className="meeting-waiting-privacy-note"><AppIcon name="lock" size="xs" /> Waiting requests are visible only to authorized hosts/cohosts and include the submitted display name, requested role, invite state, and optional request message.</p>
    <span className="sr-only" aria-live="polite">{announcement}</span>
    {visibleWaiting.map((entry) => <article key={entry.id}>
      <span className="meeting-waiting-avatar" aria-hidden="true">{entry.displayName.slice(0, 1).toUpperCase()}</span>
      <span className="meeting-waiting-identity">
        <strong>{entry.displayName}</strong>
        <small>{entry.requestedRole} · {entry.inviteId ? "Invited request" : "Join request"} · {requestTime(entry.requestedAt)}</small>
        {entry.requestMessage ? <p>{entry.requestMessage}</p> : null}
      </span>
      <span className="meeting-waiting-actions">
        <button type="button" disabled={busyKeys.has(entry.id)} onClick={() => void resolveOne(entry, "admit")}>Admit</button>
        <button type="button" className="is-danger" disabled={busyKeys.has(entry.id)} onClick={() => void resolveOne(entry, "deny")}>Deny</button>
      </span>
    </article>)}
    {!waiting.length ? <div className="meeting-waiting-queue__empty"><AppIcon name="users" size="sm" /><span>No one is waiting.</span></div> : visibleWaiting.length === 0 ? <div className="meeting-waiting-queue__empty"><AppIcon name="search" size="sm" /><span>No waiting request matches this search.</span></div> : null}
    {confirmation ? <div className="meeting-waiting-confirm" role="alertdialog" aria-modal="true" aria-labelledby="meeting-waiting-confirm-title">
      <div>
        <span className="meeting-status-surface__icon"><AppIcon name={confirmation === "admit" ? "users" : "close"} size="lg" /></span>
        <strong id="meeting-waiting-confirm-title">{confirmation === "admit" ? "Admit everyone?" : "Deny everyone?"}</strong>
        <p>This will {confirmation} {waiting.length} waiting {waiting.length === 1 ? "person" : "people"}. Picom will apply the decision on the server.</p>
        <span>
          <button type="button" className="secondary" disabled={busyKeys.size > 0} onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className={confirmation === "deny" ? "is-danger" : ""} disabled={busyKeys.size > 0} onClick={() => void resolveAll(confirmation)}>Confirm {confirmation}</button>
        </span>
      </div>
    </div> : null}
  </section>;
}
